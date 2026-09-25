/* eslint-disable max-lines */

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { Vector3Like } from "three";

// Import Internal Dependencies
import {
  VoxelLayer,
  type VoxelLayerCloneOptions,
  type VoxelLayerConfigurableOptions,
  type VoxelLayerOptions
} from "./VoxelLayer.ts";
import { VoxelChunk, DEFAULT_CHUNK_SIZE } from "./VoxelChunk.ts";
import {
  packVoxel,
  VOXEL_ABSENT,
  type PackedVoxel
} from "./packedVoxel.ts";
import type {
  VoxelCellChange,
  VoxelCoord,
  VoxelEditRecorder,
  VoxelEntry
} from "./types.ts";
import {
  assertPowerOfTwoChunkSize,
  FACE_OFFSETS,
  type FACE
} from "../utils/math.ts";
import {
  VoxelTransform,
  type VoxelTransformOptions
} from "./VoxelTransform.ts";
import type { VoxelLayerCommand } from "../commands.ts";
import { dispatchCommand } from "./dispatchCommand.ts";
import type { VoxelLogger } from "../utils/logger.ts";
import { VoxelEditBatch } from "./VoxelEditBatch.ts";
import { VoxelObjectLayers } from "./VoxelObjectLayers.ts";
import { VoxelLayerStack } from "./VoxelLayerStack.ts";
import {
  assertVoxelPatchCells,
  VOXEL_PATCH_STRIDE
} from "./voxelPatch.ts";
import { isAir } from "../blocks/BlockId.ts";

export type VoxelWorldEvents = {
  command: (command: VoxelLayerCommand) => void;
};

export type IterableLayerChunk = {
  layer: VoxelLayer;
  chunk: VoxelChunk;
};

export interface VoxelSetOptions extends VoxelTransformOptions {
  position: Vector3Like;
  blockId: number;
}

export interface VoxelRemoveOptions {
  position: Vector3Like;
}

interface VoxelWrite {
  position: Vector3Like;
  packed: PackedVoxel;
}

/**
 * Layered voxel data ordered from highest to lowest compositing priority.
 */
export class VoxelWorld extends Emitter<VoxelWorldEvents> {
  readonly chunkSize: number;
  readonly objectLayers = new VoxelObjectLayers(
    (command) => this.#emit(command)
  );

  recorder: VoxelEditRecorder | null = null;

  #layers = new VoxelLayerStack();
  #muted = false;
  #batch: VoxelEditBatch | null = null;

  constructor(
    chunkSize: number = DEFAULT_CHUNK_SIZE
  ) {
    super();
    assertPowerOfTwoChunkSize(chunkSize, "VoxelWorld");

    this.chunkSize = chunkSize;
  }

  addLayer(
    name: string,
    options: VoxelLayerConfigurableOptions = {}
  ): VoxelLayer {
    const layer = new VoxelLayer({
      id: this.#layers.nextId("layer_"),
      name,
      order: this.#layers.size,
      chunkSize: this.chunkSize,
      ...options
    });
    this.#layers.insert(0, layer);
    this.#emit({
      action: "added",
      layerName: name,
      metadata: { options }
    });

    return layer;
  }

  updateLayer(
    name: string,
    options: Partial<VoxelLayerConfigurableOptions>
  ): boolean {
    const layer = this.getLayer(name);
    if (!layer) {
      return false;
    }

    if (options.properties) {
      layer.properties = structuredClone(options.properties);
    }
    if (options.visible !== undefined) {
      this.#updateLayerVisibility(layer, options.visible);
    }
    if (options.opacity !== undefined) {
      this.#updateLayerOpacity(layer, options.opacity);
    }
    if (options.compositing !== undefined &&
      options.compositing !== layer.compositing) {
      layer.compositing = options.compositing;
      this.#markAllLayersDirty();
    }
    this.#emit({
      action: "updated",
      layerName: name,
      metadata: { options }
    });

    return true;
  }

  removeLayer(
    name: string
  ): boolean {
    const layer = this.getLayer(name);
    if (!layer) {
      return false;
    }

    this.#layers.detach(layer);
    this.#markAllLayersDirty();
    this.#emit({
      action: "removed",
      layerName: name,
      metadata: {}
    });

    return true;
  }

  moveLayer(
    name: string,
    direction: "up" | "down"
  ): void {
    const index = this.#layers.indexOf(name);
    const delta = direction === "up" ? -1 : 1;
    if (index === -1 || !this.#moveLayer(index, index + delta)) {
      return;
    }

    this.#emit({
      action: "reordered",
      layerName: name,
      metadata: { direction }
    });
  }

  moveLayerTo(
    name: string,
    toIndex: number
  ): void {
    const index = this.#layers.indexOf(name);
    const clamped = Math.min(
      Math.max(Math.trunc(toIndex), 0),
      this.#layers.size - 1
    );
    if (index === -1 || !this.#moveLayer(index, clamped)) {
      return;
    }

    this.#emit({
      action: "layer-moved",
      layerName: name,
      metadata: { toIndex: clamped }
    });
  }

  setLayerVisible(
    name: string,
    visible: boolean
  ): void {
    const layer = this.getLayer(name);
    if (layer) {
      this.#updateLayerVisibility(layer, visible);
    }
  }

  setLayerOpacity(
    name: string,
    opacity: number
  ): void {
    const layer = this.getLayer(name);
    if (layer) {
      this.#updateLayerOpacity(layer, opacity);
    }
  }

  setLayerPosition(
    name: string,
    position: VoxelCoord
  ): void {
    const layer = this.getLayer(name);
    if (!layer) {
      return;
    }

    layer.position = { ...position };
    this.#markAllLayersDirty();
    this.#emit({
      action: "position-updated",
      layerName: name,
      metadata: { position }
    });
  }

  translateLayer(
    name: string,
    delta: VoxelCoord
  ): void {
    const layer = this.getLayer(name);
    if (!layer) {
      return;
    }

    layer.position = {
      x: layer.position.x + delta.x,
      y: layer.position.y + delta.y,
      z: layer.position.z + delta.z
    };
    this.#markAllLayersDirty();
    this.#emit({
      action: "position-updated",
      layerName: name,
      metadata: { delta }
    });
  }

  rebaseLayer(
    name: string,
    position: VoxelCoord
  ): void {
    const layer = this.getLayer(name);
    if (!layer) {
      return;
    }

    layer.rebase(position);
    this.#markAllLayersDirty();
    this.#emit({
      action: "position-rebased",
      layerName: name,
      metadata: { position }
    });
  }

  getLayers(): readonly VoxelLayer[] {
    return this.#layers.toArray();
  }

  get voxelCount(): number {
    let total = 0;
    for (const layer of this.#layers) {
      total += layer.voxelCount;
    }

    return total;
  }

  countBlocks(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const layer of this.#layers) {
      for (const [blockId, count] of layer.countBlocks()) {
        counts.set(blockId, (counts.get(blockId) ?? 0) + count);
      }
    }

    return counts;
  }

  countBlock(
    blockId: number
  ): number {
    let total = 0;
    for (const layer of this.#layers) {
      total += layer.countBlock(blockId);
    }

    return total;
  }

  getLayer(
    name: string
  ): VoxelLayer | undefined {
    return this.#layers.get(name);
  }

  cloneLayer(
    name: string,
    options: Partial<VoxelLayerOptions> = {}
  ): VoxelLayer | undefined {
    const index = this.#layers.indexOf(name);
    const layer = this.#layers.at(index);
    if (!layer) {
      return undefined;
    }

    const resolved: VoxelLayerCloneOptions = {
      ...options,
      name: this.uniqueLayerName(options.name ?? layer.name)
    };
    const clone = layer.clone({
      ...resolved,
      id: this.#layers.nextId(`${layer.id}_`)
    });

    this.#layers.insert(index, clone);
    this.#markAllLayersDirty();
    this.#emit({
      action: "cloned",
      layerName: name,
      metadata: { options: resolved }
    });

    return clone;
  }

  uniqueLayerName(
    base: string
  ): string {
    return this.#layers.uniqueName(base);
  }

  mergeLayer(
    sourceName: string,
    targetName: string
  ): boolean {
    const source = this.getLayer(sourceName);
    const target = this.getLayer(targetName);
    if (!source || !target || source === target) {
      return false;
    }

    target.mergeFrom(source, {
      overwrite: source.order > target.order
    });
    target.properties = {
      ...structuredClone(source.properties),
      ...target.properties
    };

    this.#layers.detach(source);
    this.#markAllLayersDirty();
    this.#emit({
      action: "merged",
      layerName: sourceName,
      metadata: { targetLayerName: targetName }
    });

    return true;
  }

  mergeAllLayers(): VoxelLayer | null {
    if (this.#layers.size <= 1) {
      return this.#layers.at(0) ?? null;
    }

    const [target, ...sources] = [...this.#layers].reverse();
    for (const source of sources) {
      target.mergeFrom(source, { overwrite: true });
      this.#layers.detach(source);
    }
    target.markAllDirty();

    return target;
  }

  getVoxelAt(
    position: Vector3Like
  ): VoxelEntry | undefined {
    return this.#compositedLayerAt(position)?.getVoxelAt(position);
  }

  getPackedVoxelAt(
    position: Vector3Like
  ): PackedVoxel {
    return this.#compositedLayerAt(position)?.getPackedVoxelAt(position) ??
      VOXEL_ABSENT;
  }

  getVoxelWithLayerAt(
    position: Vector3Like
  ): { entry: VoxelEntry; layer: VoxelLayer; } | undefined {
    const layer = this.#compositedLayerAt(position);
    const entry = layer?.getVoxelAt(position);

    return layer && entry && { entry, layer };
  }

  getVoxelNeighbour(
    position: Vector3Like,
    face: FACE
  ): VoxelEntry | undefined {
    const offset = FACE_OFFSETS[face];

    return this.getVoxelAt({
      x: position.x + offset[0],
      y: position.y + offset[1],
      z: position.z + offset[2]
    });
  }

  setVoxel(
    layerName: string,
    options: VoxelSetOptions
  ): void {
    const { position, blockId } = options;
    const transform = VoxelTransform.fromPacked(VoxelTransform.pack(options));

    this.#write(
      layerName,
      [{ position, packed: packVoxel(blockId, transform.packed) }],
      {
        action: "voxel-set",
        layerName,
        metadata: {
          position,
          blockId,
          rotation: transform.rotation,
          flipX: transform.flipX,
          flipZ: transform.flipZ,
          flipY: transform.flipY
        }
      }
    );
  }

  removeVoxel(
    layerName: string,
    options: VoxelRemoveOptions
  ): void {
    const { position } = options;

    this.#write(
      layerName,
      [{ position, packed: VOXEL_ABSENT }],
      {
        action: "voxel-removed",
        layerName,
        metadata: { position }
      }
    );
  }

  setVoxelBulk(
    layerName: string,
    entries: VoxelSetOptions[]
  ): void {
    this.#write(
      layerName,
      entries.map((entry) => {
        return {
          position: entry.position,
          packed: packVoxel(entry.blockId, VoxelTransform.pack(entry))
        };
      }),
      {
        action: "voxels-set",
        layerName,
        metadata: { entries }
      }
    );
  }

  removeVoxelBulk(
    layerName: string,
    entries: VoxelRemoveOptions[]
  ): void {
    this.#write(
      layerName,
      entries.map(({ position }) => {
        return { position, packed: VOXEL_ABSENT };
      }),
      {
        action: "voxels-removed",
        layerName,
        metadata: { entries }
      }
    );
  }

  patchVoxels(
    layerName: string,
    cells: readonly number[]
  ): void {
    assertVoxelPatchCells(cells);

    const writes: VoxelWrite[] = [];
    for (let index = 0; index < cells.length; index += VOXEL_PATCH_STRIDE) {
      const blockId = cells[index + 3];
      writes.push({
        position: {
          x: cells[index],
          y: cells[index + 1],
          z: cells[index + 2]
        },
        packed: isAir(blockId) ?
          VOXEL_ABSENT :
          packVoxel(blockId, cells[index + 4])
      });
    }

    this.transaction(() => this.#write(layerName, writes));
  }

  transaction<T>(
    fn: () => T
  ): T {
    if (this.#batch !== null) {
      return fn();
    }

    const batch = new VoxelEditBatch(this.chunkSize);
    this.#batch = batch;
    try {
      return fn();
    }
    finally {
      this.#batch = null;
      batch.markDirty(this.#layers.toArray());
      this.#flushBatch(batch);
    }
  }

  setVoxelAt(
    layerName: string,
    position: Vector3Like,
    entry: VoxelEntry
  ): void {
    this.setPackedVoxelAt(
      layerName,
      position,
      packVoxel(entry.blockId, entry.transform)
    );
  }

  setPackedVoxelAt(
    layerName: string,
    position: Vector3Like,
    packed: PackedVoxel
  ): void {
    const layer = this.getLayer(layerName);
    if (!layer) {
      throw new Error(`VoxelWorld: layer "${layerName}" does not exist.`);
    }

    this.#store(layer, position, packed);
  }

  removeVoxelAt(
    layerName: string,
    position: Vector3Like
  ): void {
    const layer = this.getLayer(layerName);
    if (layer) {
      this.#store(layer, position, VOXEL_ABSENT);
    }
  }

  getAllDirtyChunks(): IterableIterator<IterableLayerChunk> {
    return layerChunks(this.#layers, (layer) => layer.getDirtyChunks());
  }

  getAllChunks(): IterableIterator<IterableLayerChunk> {
    return layerChunks(this.#layers, (layer) => layer.getChunks());
  }

  * getAllChunksToBeRemoved(): IterableIterator<IterableLayerChunk> {
    yield* layerChunks(
      this.#layers.drainDetached(),
      (layer) => layer.getChunks()
    );
    yield* layerChunks(
      this.#layers,
      (layer) => layer.drainPendingRemovals()
    );
  }

  apply(
    command: VoxelLayerCommand,
    logger?: VoxelLogger
  ): void {
    this.silently(() => dispatchCommand(this, command, logger));
  }

  silently<T>(
    fn: () => T
  ): T {
    const previous = this.#muted;
    this.#muted = true;
    try {
      return fn();
    }
    finally {
      this.#muted = previous;
    }
  }

  clear(): void {
    this.#layers.clear();
    this.objectLayers.clear();
  }

  #write(
    layerName: string,
    writes: readonly VoxelWrite[],
    command?: VoxelLayerCommand
  ): void {
    const layer = this.getLayer(layerName);
    if (!layer) {
      if (writes.some(({ packed }) => packed !== VOXEL_ABSENT)) {
        throw new Error(`VoxelWorld: layer "${layerName}" does not exist.`);
      }

      return;
    }

    const batch = this.#batch;
    const recorder = this.#muted ? null : this.recorder;
    if (batch !== null) {
      const options = {
        track: !this.#muted,
        record: recorder !== null
      };
      for (const { position, packed } of writes) {
        batch.write(layer, position, packed, options);
      }

      return;
    }

    const changes: VoxelCellChange[] = [];
    for (const { position, packed } of writes) {
      const before = recorder === null ?
        packed :
        layer.getPackedVoxelAt(position);
      this.#store(layer, position, packed);

      if (before !== packed) {
        changes.push({
          layerName,
          position: {
            x: position.x,
            y: position.y,
            z: position.z
          },
          before,
          after: packed
        });
      }
    }
    if (changes.length > 0) {
      recorder?.record(changes);
    }
    if (command) {
      this.#emit(command);
    }
  }

  #store(
    layer: VoxelLayer,
    position: Vector3Like,
    packed: PackedVoxel
  ): void {
    if (packed === VOXEL_ABSENT) {
      layer.removeVoxelAt(position);
    }
    else {
      layer.setPackedVoxelAt(position, packed);
    }

    if (this.#batch !== null) {
      this.#batch.touch(layer, position);

      return;
    }

    for (const candidate of this.#layers) {
      candidate.markCellDirty(position);
    }
  }

  #flushBatch(
    batch: VoxelEditBatch
  ): void {
    for (const { layer, cells, changes } of batch.drain()) {
      if (changes.length > 0) {
        this.recorder?.record(changes);
      }
      this.emit("command", {
        action: "voxels-patched",
        layerName: layer.name,
        metadata: { cells }
      });
    }
  }

  #emit(
    command: VoxelLayerCommand
  ): void {
    if (this.#muted) {
      return;
    }
    if (this.#batch !== null) {
      this.#flushBatch(this.#batch);
    }

    this.emit("command", command);
  }

  #compositedLayerAt(
    position: Vector3Like
  ): VoxelLayer | undefined {
    return this.#layers.toArray().find(
      (layer) => layer.effectivelyVisible &&
        layer.getPackedVoxelAt(position) !== VOXEL_ABSENT
    );
  }

  #moveLayer(
    fromIndex: number,
    toIndex: number
  ): boolean {
    if (!this.#layers.move(fromIndex, toIndex)) {
      return false;
    }
    this.#markAllLayersDirty();

    return true;
  }

  #updateLayerVisibility(
    layer: VoxelLayer,
    visible: boolean
  ): void {
    const flipped = layer.visible !== visible;
    layer.visible = visible;
    this.#markLayerChanged(layer, flipped);
  }

  #updateLayerOpacity(
    layer: VoxelLayer,
    opacity: number
  ): void {
    const wasOccluding = layer.opacity >= 1;
    layer.opacity = opacity;
    this.#markLayerChanged(layer, wasOccluding !== layer.opacity >= 1);
  }

  #markLayerChanged(
    layer: VoxelLayer,
    affectsOtherLayers: boolean
  ): void {
    if (affectsOtherLayers) {
      this.#markAllLayersDirty();
    }
    else {
      layer.markAllDirty();
    }
  }

  #markAllLayersDirty(): void {
    for (const layer of this.#layers) {
      layer.markAllDirty();
    }
  }
}

function* layerChunks(
  layers: Iterable<VoxelLayer>,
  chunksOf: (layer: VoxelLayer) => Iterable<VoxelChunk>
): IterableIterator<IterableLayerChunk> {
  for (const layer of layers) {
    for (const chunk of chunksOf(layer)) {
      yield { layer, chunk };
    }
  }
}
