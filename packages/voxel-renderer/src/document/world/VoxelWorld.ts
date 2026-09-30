// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type {
  VoxelLayer,
  VoxelLayerConfigurableOptions,
  VoxelLayerOptions,
  VoxelLayerUpdate
} from "./VoxelLayer.ts";
import { VoxelLayerStack } from "./VoxelLayerStack.ts";
import {
  VoxelLayerStructure,
  type VoxelLayerRestoreOptions
} from "./VoxelLayerStructure.ts";
import {
  VoxelChunk,
  DEFAULT_CHUNK_SIZE
} from "./storage/VoxelChunk.ts";
import {
  VOXEL_ABSENT,
  type PackedVoxel
} from "./storage/packedVoxel.ts";
import type {
  VoxelCoord,
  VoxelEditRecorder,
  VoxelRecorderOptions,
  VoxelEntry
} from "./types.ts";
import {
  VoxelWriter,
  type VoxelWriteMode
} from "./editing/VoxelWriter.ts";
import { VoxelObjectLayers } from "./objects/VoxelObjectLayers.ts";
import { VoxelTemplates } from "./templates/VoxelTemplates.ts";
import {
  VoxelTransform,
  type VoxelTransformOptions
} from "../geometry/VoxelTransform.ts";
import {
  FACE_OFFSETS,
  type FACE
} from "../geometry/faceDirection.ts";
import type {
  VoxelEditCommand,
  VoxelLayerCommand,
  VoxelWorldContentCommand
} from "../commands/types.ts";
import {
  isVoxelEditCommand,
  isVoxelObjectLayerCommand,
  isVoxelTemplateCommand
} from "../commands/categories.ts";
import type { VoxelPatchCells } from "./editing/voxelPatch.ts";
import { removeBlockVoxels } from "./editing/removeBlockVoxels.ts";
import { assertPowerOfTwoChunkSize } from "./storage/chunkSize.ts";
import type { VoxelLogger } from "../../VoxelLogger.ts";

export type VoxelWorldEvents = {
  command: (command: VoxelWorldContentCommand) => void;
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

export interface VoxelMergeAllLayersOptions {
  except?: Iterable<string>;
}

export type { VoxelLayerRestoreOptions };

/**
 * Layered voxel data ordered from highest to lowest compositing priority.
 */
export class VoxelWorld extends Emitter<VoxelWorldEvents> {
  readonly chunkSize: number;
  readonly objectLayers = new VoxelObjectLayers(
    (command) => this.#dispatch(command) !== null
  );
  readonly templates: VoxelTemplates;

  #layers = new VoxelLayerStack();
  #structure: VoxelLayerStructure;
  #writer: VoxelWriter;
  #silent = false;

  constructor(
    chunkSize: number = DEFAULT_CHUNK_SIZE
  ) {
    super();
    assertPowerOfTwoChunkSize(chunkSize, "VoxelWorld");

    this.chunkSize = chunkSize;
    this.#structure = new VoxelLayerStructure({
      chunkSize,
      layers: this.#layers,
      markAllDirty: () => this.markAllDirty()
    });
    this.#writer = new VoxelWriter({
      chunkSize,
      layers: this.#layers,
      publish: (command) => this.#publish(command)
    });
    this.templates = new VoxelTemplates({
      chunkSize,
      layer: (name) => this.getLayer(name),
      dispatch: (command) => this.#dispatch(command) !== null,
      patch: (layerName, cells) => this.patchVoxels(layerName, cells)
    });
  }

  addRecorder(
    recorder: VoxelEditRecorder,
    options: VoxelRecorderOptions = {}
  ): void {
    this.#writer.addRecorder(recorder, options.includeUnrecorded ?? false);
  }

  removeRecorder(
    recorder: VoxelEditRecorder
  ): boolean {
    return this.#writer.removeRecorder(recorder);
  }

  get voxelCount(): number {
    let total = 0;
    for (const layer of this.#layers) {
      total += layer.voxelCount;
    }

    return total;
  }

  addLayer(
    name: string,
    options: VoxelLayerConfigurableOptions = {}
  ): VoxelLayer {
    const layerId = crypto.randomUUID();
    this.#dispatch({
      action: "added",
      layerId,
      metadata: {
        name,
        rank: this.#layers.topRank(),
        options
      }
    });

    return this.#layers.byId(layerId)!;
  }

  restoreLayer(
    options: VoxelLayerRestoreOptions
  ): VoxelLayer {
    return this.#structure.restore(options);
  }

  updateLayer(
    name: string,
    options: VoxelLayerUpdate
  ): boolean {
    return this.#dispatch({
      action: "updated",
      layerId: this.#idOf(name),
      metadata: { options }
    }) !== null;
  }

  removeLayer(
    name: string
  ): boolean {
    return this.#dispatch({
      action: "removed",
      layerId: this.#idOf(name),
      metadata: {}
    }) !== null;
  }

  moveLayer(
    name: string,
    direction: "up" | "down"
  ): void {
    const layer = this.getLayer(name);
    if (layer !== undefined) {
      const index = this.#layers.indexOf(layer);
      const toIndex = direction === "up" ? index - 1 : index + 1;
      if (toIndex >= 0 && toIndex < this.#layers.size) {
        this.moveLayerTo(name, toIndex);
      }
    }
  }

  moveLayerTo(
    name: string,
    toIndex: number
  ): void {
    const layer = this.getLayer(name);
    const index = Math.min(Math.max(Math.trunc(toIndex), 0), this.#layers.size - 1);
    if (layer !== undefined && index !== this.#layers.indexOf(layer)) {
      this.#dispatch({
        action: "layer-moved",
        layerId: layer.id,
        metadata: { rank: this.#layers.rankAt(layer, index) }
      });
    }
  }

  setLayerPosition(
    name: string,
    position: VoxelCoord
  ): void {
    this.#dispatch({
      action: "position-updated",
      layerId: this.#idOf(name),
      metadata: { position }
    });
  }

  translateLayer(
    name: string,
    delta: VoxelCoord
  ): void {
    this.#dispatch({
      action: "position-updated",
      layerId: this.#idOf(name),
      metadata: { delta }
    });
  }

  rebaseLayer(
    name: string,
    position: VoxelCoord
  ): void {
    this.#dispatch({
      action: "position-rebased",
      layerId: this.#idOf(name),
      metadata: { position }
    });
  }

  transformLayer(
    name: string,
    transform: VoxelTransformOptions
  ): void {
    this.#dispatch({
      action: "layer-transformed",
      layerId: this.#idOf(name),
      metadata: transformFields(transform)
    });
  }

  cloneLayer(
    name: string,
    options: Partial<VoxelLayerOptions> = {}
  ): VoxelLayer | undefined {
    const layer = this.getLayer(name);
    if (!layer) {
      return undefined;
    }

    const cloneId = crypto.randomUUID();
    this.#dispatch({
      action: "cloned",
      layerId: layer.id,
      metadata: {
        cloneId,
        rank: this.#layers.rankAbove(layer),
        options: {
          ...options,
          name: options.name ?? layer.name
        }
      }
    });

    return this.#layers.byId(cloneId);
  }

  mergeLayer(
    sourceName: string,
    targetName: string
  ): boolean {
    return this.#dispatch({
      action: "merged",
      layerId: this.#idOf(sourceName),
      metadata: { targetLayerId: this.#idOf(targetName) }
    }) !== null;
  }

  mergeAllLayers(
    options: VoxelMergeAllLayersOptions = {}
  ): VoxelLayer[] {
    const excluded = new Set(options.except);
    const size = this.#layers.size;
    const merged: VoxelLayer[] = [];
    let target: VoxelLayer | null = null;
    for (const layer of [...this.#layers].reverse()) {
      if (excluded.has(layer.name)) {
        target = null;
      }
      else if (target) {
        this.#structure.merge(layer, target);
      }
      else {
        target = layer;
        merged.unshift(layer);
      }
    }
    if (this.#layers.size < size) {
      this.markAllDirty();
    }

    return merged;
  }

  getLayers(): readonly VoxelLayer[] {
    return this.#layers.toArray();
  }

  getLayer(
    name: string
  ): VoxelLayer | undefined {
    return this.#layers.get(name);
  }

  getLayerById(
    id: string
  ): VoxelLayer | undefined {
    return this.#layers.byId(id);
  }

  uniqueLayerName(
    base: string
  ): string {
    return this.#layers.uniqueName(base);
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
    this.#dispatch(voxelSetCommand(this.#idOf(layerName), options));
  }

  removeVoxel(
    layerName: string,
    options: VoxelRemoveOptions
  ): void {
    this.#dispatch({
      action: "voxel-removed",
      layerId: this.#idOf(layerName),
      metadata: { position: options.position }
    });
  }

  setVoxelBulk(
    layerName: string,
    entries: VoxelSetOptions[]
  ): void {
    this.#dispatch({
      action: "voxels-set",
      layerId: this.#idOf(layerName),
      metadata: { entries }
    });
  }

  removeVoxelBulk(
    layerName: string,
    entries: VoxelRemoveOptions[]
  ): void {
    this.#dispatch({
      action: "voxels-removed",
      layerId: this.#idOf(layerName),
      metadata: { entries }
    });
  }

  removeBlocks(
    blockIds: Iterable<number>
  ): number {
    return removeBlockVoxels(this, new Set(blockIds));
  }

  patchVoxels(
    layerName: string,
    cells: VoxelPatchCells
  ): void {
    this.#dispatch({
      action: "voxels-patched",
      layerId: this.#idOf(layerName),
      metadata: { cells }
    });
  }

  transaction<T>(
    fn: () => T
  ): T {
    return this.#writer.transaction(fn);
  }

  silently<T>(
    fn: () => T
  ): T {
    const silent = this.#silent;
    this.#silent = true;
    try {
      return fn();
    }
    finally {
      this.#silent = silent;
    }
  }

  unrecorded<T>(
    fn: () => T
  ): T {
    return this.#writer.unrecorded(fn);
  }

  apply(
    command: VoxelWorldContentCommand,
    logger?: VoxelLogger
  ): VoxelWorldContentCommand | null {
    this.#writer.flush();
    if (
      isVoxelEditCommand(command) &&
      this.#layers.byId(command.layerId) === undefined
    ) {
      logger?.warn(
        `VoxelWorld: dropped '${command.action}' for unknown layer ` +
        `'${command.layerId}'.`
      );

      return null;
    }

    return this.#execute(normalized(command), "replay");
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

  markAllDirty(): void {
    for (const layer of this.#layers) {
      layer.markAllDirty();
    }
  }

  clear(): void {
    this.#layers.clear();
    this.objectLayers.clear();
    this.templates.clear();
  }

  #dispatch(
    command: VoxelWorldContentCommand
  ): VoxelWorldContentCommand | null {
    const applied = this.#execute(command, this.#silent ? "silent" : "live");
    if (applied !== null && !this.#silent) {
      this.#writer.flush();
      this.emit("command", applied);
    }

    return applied;
  }

  #publish(
    command: VoxelLayerCommand
  ): void {
    if (!this.#silent) {
      this.emit("command", command);
    }
  }

  #execute(
    command: VoxelWorldContentCommand,
    mode: VoxelWriteMode
  ): VoxelWorldContentCommand | null {
    if (isVoxelTemplateCommand(command)) {
      return this.templates.apply(command);
    }
    if (isVoxelEditCommand(command)) {
      return this.#writer.write(
        this.#layers.byId(command.layerId),
        command,
        mode
      );
    }
    if (isVoxelObjectLayerCommand(command)) {
      return this.objectLayers.apply(command);
    }

    return this.#structure.apply(command);
  }

  #idOf(
    name: string
  ): string {
    return this.#layers.get(name)?.id ?? name;
  }

  #compositedLayerAt(
    position: Vector3Like
  ): VoxelLayer | undefined {
    return this.#layers.toArray().find(
      (layer) => layer.visible &&
        layer.getPackedVoxelAt(position) !== VOXEL_ABSENT
    );
  }
}

function voxelSetCommand(
  layerId: string,
  options: VoxelSetOptions
): VoxelEditCommand {
  const { position, blockId } = options;

  return {
    action: "voxel-set",
    layerId,
    metadata: {
      position,
      blockId,
      ...transformFields(options)
    }
  };
}

function normalized(
  command: VoxelWorldContentCommand
): VoxelWorldContentCommand {
  switch (command.action) {
    case "voxel-set":
      return voxelSetCommand(command.layerId, command.metadata);
    case "layer-transformed":
      return {
        action: "layer-transformed",
        layerId: command.layerId,
        metadata: transformFields(command.metadata)
      };
    default:
      return command;
  }
}

function transformFields(
  options: VoxelTransformOptions
): Required<VoxelTransformOptions> {
  const {
    rotation,
    flipX,
    flipZ,
    flipY
  } = VoxelTransform.fromPacked(VoxelTransform.pack(options));

  return {
    rotation,
    flipX,
    flipZ,
    flipY
  };
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
