// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import {
  VoxelLayer,
  type VoxelLayerConfigurableOptions,
  type VoxelLayerOptions
} from "./VoxelLayer.ts";
import { VoxelChunk, DEFAULT_CHUNK_SIZE } from "./VoxelChunk.ts";
import {
  packVoxel,
  unpackVoxel,
  VOXEL_ABSENT,
  type PackedVoxel
} from "./packedVoxel.ts";
import type { VoxelEntry, VoxelCoord } from "./types.ts";
import {
  assertPowerOfTwoChunkSize,
  FACE_OFFSETS,
  type FACE
} from "../utils/math.ts";
import type {
  VoxelObjectJSON,
  VoxelObjectLayerJSON
} from "../serialization/types.ts";
import type {
  PartialExcept,
  VoxelSetOptions,
  VoxelRemoveOptions
} from "../types.ts";
import { VoxelTransform } from "./VoxelTransform.ts";
import type {
  VoxelLayerHookEvent,
  VoxelLayerHookListener
} from "../hooks.ts";
import { dispatchCommand } from "./dispatchCommand.ts";

// CONSTANTS
let kLayerIdCounter = 0;
let kObjectLayerIdCounter = 0;

export type IterableLayerChunk = {
  layer: VoxelLayer;
  chunk: VoxelChunk;
};

/**
 * Layered voxel data composited by ascending `order`.
 */
export class VoxelWorld {
  readonly chunkSize: number;

  onLayerUpdated?: VoxelLayerHookListener;

  #layers: VoxelLayer[] = [];
  #layersToRemove: VoxelLayer[] = [];
  #objectLayers: Map<string, VoxelObjectLayerJSON> = new Map();
  #chunkShift: number;
  #chunkMask: number;
  #muted = false;

  constructor(
    chunkSize: number = DEFAULT_CHUNK_SIZE
  ) {
    assertPowerOfTwoChunkSize(chunkSize, "VoxelWorld");

    this.chunkSize = chunkSize;
    this.#chunkShift = Math.log2(chunkSize);
    this.#chunkMask = chunkSize - 1;
  }

  addLayer(
    name: string,
    options: VoxelLayerConfigurableOptions = {}
  ): VoxelLayer {
    const layer = new VoxelLayer({
      id: `layer_${kLayerIdCounter++}`,
      name,
      order: this.#layers.length,
      chunkSize: this.chunkSize,
      ...options
    });
    this.#layers.push(layer);
    this.#sortLayers();
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
    const idx = this.#layers.findIndex(
      (layer) => layer.name === name
    );
    if (idx === -1) {
      return false;
    }

    const layer = this.#layers[idx];
    this.#layersToRemove.push(layer);
    this.#layers.splice(idx, 1);
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
    const idx = this.#layers.findIndex(
      (layer) => layer.name === name
    );
    if (idx === -1) {
      return;
    }

    const layer = this.#layers[idx];
    const delta = direction === "up" ? 1 : -1;
    const swapIdx = idx + delta;

    if (swapIdx < 0 || swapIdx >= this.#layers.length) {
      return;
    }

    const temp = layer.order;
    layer.order = this.#layers[swapIdx].order;
    this.#layers[swapIdx].order = temp;
    this.#sortLayers();

    // Compositing order changed, so every layer remeshes.
    this.#markAllLayersDirty();
    this.#emit({
      action: "reordered",
      layerName: name,
      metadata: { direction }
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

  #updateLayerVisibility(
    layer: VoxelLayer,
    visible: boolean
  ): void {
    layer.visible = visible;
    this.#markLayerDirty(layer);
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

  #updateLayerOpacity(
    layer: VoxelLayer,
    opacity: number
  ): void {
    const wasOccluding = layer.opacity >= 1;
    layer.opacity = opacity;
    const isOccluding = layer.opacity >= 1;

    if (wasOccluding === isOccluding) {
      this.#markLayerDirty(layer);
    }
    else {
      this.#markAllLayersDirty();
    }
  }

  setLayerOffset(
    name: string,
    offset: VoxelCoord
  ): void {
    const layer = this.getLayer(name);
    if (!layer) {
      return;
    }

    layer.offset = offset;
    this.#markAllLayersDirty();
    this.#emit({
      action: "offset-updated",
      layerName: name,
      metadata: { offset }
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

    layer.offset = {
      x: layer.offset.x + delta.x,
      y: layer.offset.y + delta.y,
      z: layer.offset.z + delta.z
    };
    this.#markAllLayersDirty();
    this.#emit({
      action: "offset-updated",
      layerName: name,
      metadata: { delta }
    });
  }

  getLayers(): readonly VoxelLayer[] {
    return this.#layers;
  }

  getLayer(
    name: string
  ): VoxelLayer | undefined {
    return this.#layers.find(
      (layer) => layer.name === name
    );
  }

  cloneLayer(
    name: string,
    options: PartialExcept<VoxelLayerOptions, "name">
  ): VoxelLayer | undefined {
    const layer = this.getLayer(name);
    if (!layer) {
      return undefined;
    }

    const clone = layer.clone({ ...options, id: `${layer.id}_${kLayerIdCounter++}` });
    this.#layers.push(clone);
    this.#emit({
      action: "cloned",
      layerName: name,
      metadata: { options }
    });

    return clone;
  }

  mergeLayer(
    sourceName: string,
    targetName: string
  ): boolean {
    const source = this.getLayer(sourceName);
    const target = this.getLayer(targetName);
    if (!source || !target) {
      return false;
    }

    target.mergeFrom(source);
    this.#markLayerDirty(target);
    this.#emit({
      action: "merged",
      layerName: sourceName,
      metadata: { targetLayerName: targetName }
    });

    return true;
  }

  mergeAllLayers(): VoxelLayer | null {
    if (this.#layers.length === 0) {
      return null;
    }
    if (this.#layers.length === 1) {
      return this.#layers[0];
    }

    const sorted = [...this.#layers].sort((a, b) => a.order - b.order);
    const target = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      target.mergeFrom(sorted[i]);
    }

    for (let i = 1; i < sorted.length; i++) {
      const idx = this.#layers.findIndex((l) => l === sorted[i]);
      if (idx !== -1) {
        this.#layersToRemove.push(this.#layers[idx]);
        this.#layers.splice(idx, 1);
      }
    }

    this.#markLayerDirty(target);

    return target;
  }

  addObjectLayer(
    name: string,
    options: Partial<Pick<VoxelObjectLayerJSON, "visible" | "order">> = {}
  ): VoxelObjectLayerJSON {
    const layer: VoxelObjectLayerJSON = {
      id: `obj_layer_${kObjectLayerIdCounter++}`,
      name,
      visible: options.visible ?? true,
      order: options.order ?? this.#objectLayers.size,
      objects: []
    };
    this.#objectLayers.set(name, layer);
    this.#emit({
      action: "object-layer-added",
      layerName: name,
      metadata: {}
    });

    return layer;
  }

  removeObjectLayer(
    name: string
  ): boolean {
    if (!this.#objectLayers.delete(name)) {
      return false;
    }

    this.#emit({
      action: "object-layer-removed",
      layerName: name,
      metadata: {}
    });

    return true;
  }

  getObjectLayer(
    name: string
  ): VoxelObjectLayerJSON | undefined {
    return this.#objectLayers.get(name);
  }

  getObjectLayers(): readonly VoxelObjectLayerJSON[] {
    return [...this.#objectLayers.values()];
  }

  updateObjectLayer(
    name: string,
    patch: Partial<Pick<VoxelObjectLayerJSON, "visible">>
  ): boolean {
    const layer = this.#objectLayers.get(name);
    if (!layer) {
      return false;
    }

    if (patch.visible !== undefined) {
      layer.visible = patch.visible;
    }
    this.#emit({
      action: "object-layer-updated",
      layerName: name,
      metadata: { patch }
    });

    return true;
  }

  addObjectToLayer(
    layerName: string,
    object: VoxelObjectJSON
  ): boolean {
    const layer = this.#objectLayers.get(layerName);
    if (!layer) {
      return false;
    }

    layer.objects.push(object);
    this.#emit({
      action: "object-added",
      layerName,
      metadata: { object }
    });

    return true;
  }

  removeObjectFromLayer(
    layerName: string,
    objectId: string
  ): boolean {
    const layer = this.#objectLayers.get(layerName);
    if (!layer) {
      return false;
    }

    const idx = layer.objects.findIndex(
      (object) => object.id === objectId
    );
    if (idx === -1) {
      return false;
    }

    layer.objects.splice(idx, 1);
    this.#emit({
      action: "object-removed",
      layerName,
      metadata: { objectId }
    });

    return true;
  }

  updateObjectInLayer(
    layerName: string,
    objectId: string,
    patch: Partial<VoxelObjectJSON>
  ): boolean {
    const layer = this.#objectLayers.get(layerName);
    if (!layer) {
      return false;
    }

    const obj = layer.objects.find(
      (object) => object.id === objectId
    );
    if (!obj) {
      return false;
    }

    Object.assign(obj, patch);
    this.#emit({
      action: "object-updated",
      layerName,
      metadata: { objectId, patch }
    });

    return true;
  }

  getVoxelAt(
    position: Vector3Like
  ): VoxelEntry | undefined {
    return this.getVoxelWithLayerAt(position)?.entry;
  }

  getPackedVoxelAt(
    position: Vector3Like
  ): PackedVoxel {
    for (const layer of this.#layers) {
      if (!layer.visible || layer.opacity === 0) {
        continue;
      }
      const packed = layer.getPackedVoxelAt(position);
      if (packed !== VOXEL_ABSENT) {
        return packed;
      }
    }

    return VOXEL_ABSENT;
  }

  getVoxelWithLayerAt(
    position: Vector3Like
  ): { entry: VoxelEntry; layer: VoxelLayer; } | undefined {
    for (const layer of this.#layers) {
      if (!layer.visible || layer.opacity === 0) {
        continue;
      }
      const packed = layer.getPackedVoxelAt(position);
      if (packed !== VOXEL_ABSENT) {
        return { entry: unpackVoxel(packed), layer };
      }
    }

    return undefined;
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
    const transform = new VoxelTransform(options);

    this.setVoxelAt(layerName, position, {
      blockId,
      transform: transform.packed
    });
    this.#emit({
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
    });
  }

  removeVoxel(
    layerName: string,
    options: VoxelRemoveOptions
  ): void {
    this.removeVoxelAt(layerName, options.position);
    this.#emit({
      action: "voxel-removed",
      layerName,
      metadata: { position: options.position }
    });
  }

  setVoxelBulk(
    layerName: string,
    entries: VoxelSetOptions[]
  ): void {
    for (const entry of entries) {
      this.setVoxelAt(layerName, entry.position, {
        blockId: entry.blockId,
        transform: new VoxelTransform(entry).packed
      });
    }
    this.#emit({
      action: "voxels-set",
      layerName,
      metadata: { entries }
    });
  }

  removeVoxelBulk(
    layerName: string,
    entries: VoxelRemoveOptions[]
  ): void {
    for (const { position } of entries) {
      this.removeVoxelAt(layerName, position);
    }
    this.#emit({
      action: "voxels-removed",
      layerName,
      metadata: { entries }
    });
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

    layer.setPackedVoxelAt(position, packed);
    this.#markNeighbourChunksDirty(layer, position);
  }

  removeVoxelAt(
    layerName: string,
    position: Vector3Like
  ): void {
    const layer = this.getLayer(layerName);
    if (!layer) {
      return;
    }

    layer.removeVoxelAt(position);
    this.#markNeighbourChunksDirty(layer, position);
  }

  * getAllDirtyChunks(): IterableIterator<IterableLayerChunk> {
    for (const layer of this.#layers) {
      for (const chunk of layer.getChunks()) {
        if (chunk.dirty) {
          yield { layer, chunk };
        }
      }

      if (layer.wasVisible) {
        layer.wasVisible = false;
      }
    }
  }

  * getAllChunks(): IterableIterator<IterableLayerChunk> {
    for (const layer of this.#layers) {
      for (const chunk of layer.getChunks()) {
        yield { layer, chunk };
      }
    }
  }

  * getAllChunksToBeRemoved(): IterableIterator<IterableLayerChunk> {
    do {
      const layer = this.#layersToRemove.pop();
      if (!layer) {
        break;
      }
      if (!layer.visible && !layer.wasVisible) {
        continue;
      }

      for (const chunk of layer.getChunks()) {
        yield { layer, chunk };
      }
    } while (this.#layersToRemove.length > 0);

    for (const layer of this.#layers) {
      for (const chunk of layer.drainPendingRemovals()) {
        yield { layer, chunk };
      }
    }
  }

  applyRemoteCommand(
    cmd: VoxelLayerHookEvent
  ): void {
    this.silently(() => dispatchCommand(this, cmd));
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

  #emit(
    event: VoxelLayerHookEvent
  ): void {
    if (this.#muted) {
      return;
    }

    this.onLayerUpdated?.(event);
  }

  clear(): void {
    this.#layers = [];
    this.#layersToRemove = [];
    this.#objectLayers.clear();
  }

  #sortLayers(): void {
    this.#layers.sort(
      (a, b) => b.order - a.order
    );
  }

  #markLayerDirty(
    layer: VoxelLayer
  ): void {
    for (const chunk of layer.getChunks()) {
      chunk.dirty = true;
    }
  }

  #markAllLayersDirty(): void {
    for (const layer of this.#layers) {
      this.#markLayerDirty(layer);
    }
  }

  #markNeighbourChunksDirty(
    layer: VoxelLayer,
    position: Vector3Like
  ): void {
    const s = this.chunkSize;
    const shift = this.#chunkShift;
    const mask = this.#chunkMask;

    const x = position.x - layer.offset.x;
    const y = position.y - layer.offset.y;
    const z = position.z - layer.offset.z;

    const cx = x >> shift;
    const cy = y >> shift;
    const cz = z >> shift;

    const lx = x & mask;
    const ly = y & mask;
    const lz = z & mask;

    if (lx === 0) {
      layer.markChunkDirty(cx - 1, cy, cz);
    }
    if (lx === s - 1) {
      layer.markChunkDirty(cx + 1, cy, cz);
    }
    if (ly === 0) {
      layer.markChunkDirty(cx, cy - 1, cz);
    }
    if (ly === s - 1) {
      layer.markChunkDirty(cx, cy + 1, cz);
    }
    if (lz === 0) {
      layer.markChunkDirty(cx, cy, cz - 1);
    }
    if (lz === s - 1) {
      layer.markChunkDirty(cx, cy, cz + 1);
    }
  }
}
