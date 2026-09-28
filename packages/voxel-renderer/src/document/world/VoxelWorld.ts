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
import { VoxelLayerStack } from "./VoxelLayerStack.ts";
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
  VoxelLayerStructureCommand,
  VoxelWorldContentCommand
} from "../commands/types.ts";
import {
  isVoxelEditCommand,
  isVoxelObjectLayerCommand,
  isVoxelTemplateCommand
} from "../commands/categories.ts";
import type { VoxelPatchCells } from "./editing/voxelPatch.ts";
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

export type VoxelLayerRestoreOptions = Omit<
  VoxelLayerOptions,
  "chunkSize" | "order"
>;

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
  #writer: VoxelWriter;
  #silent = false;

  constructor(
    chunkSize: number = DEFAULT_CHUNK_SIZE
  ) {
    super();
    assertPowerOfTwoChunkSize(chunkSize, "VoxelWorld");

    this.chunkSize = chunkSize;
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

  get recorder(): VoxelEditRecorder | null {
    return this.#writer.recorder;
  }

  set recorder(
    recorder: VoxelEditRecorder | null
  ) {
    this.#writer.recorder = recorder;
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
    this.#dispatch({
      action: "added",
      layerName: name,
      metadata: { options }
    });

    return this.getLayer(name)!;
  }

  restoreLayer(
    options: VoxelLayerRestoreOptions
  ): VoxelLayer {
    const layer = new VoxelLayer({
      ...options,
      order: this.#layers.size,
      chunkSize: this.chunkSize
    });
    this.#layers.insert(0, layer);

    return layer;
  }

  updateLayer(
    name: string,
    options: Partial<VoxelLayerConfigurableOptions>
  ): boolean {
    return this.#dispatch({
      action: "updated",
      layerName: name,
      metadata: { options }
    }) !== null;
  }

  removeLayer(
    name: string
  ): boolean {
    return this.#dispatch({
      action: "removed",
      layerName: name,
      metadata: {}
    }) !== null;
  }

  moveLayer(
    name: string,
    direction: "up" | "down"
  ): void {
    this.#dispatch({
      action: "reordered",
      layerName: name,
      metadata: { direction }
    });
  }

  moveLayerTo(
    name: string,
    toIndex: number
  ): void {
    this.#dispatch({
      action: "layer-moved",
      layerName: name,
      metadata: { toIndex }
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

  setLayerPosition(
    name: string,
    position: VoxelCoord
  ): void {
    this.#dispatch({
      action: "position-updated",
      layerName: name,
      metadata: { position }
    });
  }

  translateLayer(
    name: string,
    delta: VoxelCoord
  ): void {
    this.#dispatch({
      action: "position-updated",
      layerName: name,
      metadata: { delta }
    });
  }

  rebaseLayer(
    name: string,
    position: VoxelCoord
  ): void {
    this.#dispatch({
      action: "position-rebased",
      layerName: name,
      metadata: { position }
    });
  }

  transformLayer(
    name: string,
    transform: VoxelTransformOptions
  ): void {
    this.#dispatch({
      action: "layer-transformed",
      layerName: name,
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

    const cloneName = this.uniqueLayerName(options.name ?? layer.name);
    this.#dispatch({
      action: "cloned",
      layerName: name,
      metadata: {
        options: {
          ...options,
          name: cloneName
        }
      }
    });

    return this.getLayer(cloneName);
  }

  mergeLayer(
    sourceName: string,
    targetName: string
  ): boolean {
    return this.#dispatch({
      action: "merged",
      layerName: sourceName,
      metadata: { targetLayerName: targetName }
    }) !== null;
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

  getLayers(): readonly VoxelLayer[] {
    return this.#layers.toArray();
  }

  getLayer(
    name: string
  ): VoxelLayer | undefined {
    return this.#layers.get(name);
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
    this.#dispatch(voxelSetCommand(layerName, options));
  }

  removeVoxel(
    layerName: string,
    options: VoxelRemoveOptions
  ): void {
    this.#dispatch({
      action: "voxel-removed",
      layerName,
      metadata: { position: options.position }
    });
  }

  setVoxelBulk(
    layerName: string,
    entries: VoxelSetOptions[]
  ): void {
    this.#dispatch({
      action: "voxels-set",
      layerName,
      metadata: { entries }
    });
  }

  removeVoxelBulk(
    layerName: string,
    entries: VoxelRemoveOptions[]
  ): void {
    this.#dispatch({
      action: "voxels-removed",
      layerName,
      metadata: { entries }
    });
  }

  patchVoxels(
    layerName: string,
    cells: VoxelPatchCells
  ): void {
    this.#dispatch({
      action: "voxels-patched",
      layerName,
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
      this.getLayer(command.layerName) === undefined
    ) {
      logger?.warn(
        `VoxelWorld: dropped '${command.action}' for unknown layer ` +
        `'${command.layerName}'.`
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
      return this.#writer.write(this.getLayer(command.layerName), command, mode);
    }
    if (isVoxelObjectLayerCommand(command)) {
      return this.objectLayers.apply(command);
    }

    return this.#restructure(command);
  }

  #restructure(
    command: VoxelLayerStructureCommand
  ): VoxelLayerStructureCommand | null {
    const layer = this.getLayer(command.layerName);

    switch (command.action) {
      case "added":
        this.restoreLayer({
          ...command.metadata.options,
          id: this.#layers.nextId("layer_"),
          name: command.layerName
        });

        return command;
      case "cloned":
        return layer ? this.#clone(layer, command.metadata.options) : null;
      case "layer-moved":
        return this.#moveTo(command.layerName, command.metadata.toIndex);
      default:
        return layer && this.#change(layer, command) ? command : null;
    }
  }

  #change(
    layer: VoxelLayer,
    command: VoxelLayerStructureCommand
  ): boolean {
    switch (command.action) {
      case "updated":
        this.#update(layer, command.metadata.options);

        return true;
      case "removed":
        this.#layers.detach(layer);
        break;
      case "reordered": {
        const index = this.#layers.indexOf(layer.name);
        const delta = command.metadata.direction === "up" ? -1 : 1;
        if (!this.#layers.move(index, index + delta)) {
          return false;
        }
        break;
      }
      case "position-updated": {
        const { metadata } = command;
        layer.position = "position" in metadata ?
          { ...metadata.position } :
          {
            x: layer.position.x + metadata.delta.x,
            y: layer.position.y + metadata.delta.y,
            z: layer.position.z + metadata.delta.z
          };
        break;
      }
      case "position-rebased":
        layer.rebase(command.metadata.position);
        break;
      case "merged":
        if (!this.#merge(layer, command.metadata.targetLayerName)) {
          return false;
        }
        break;
      default:
        throw new Error(
          `VoxelWorld: unhandled action '${command.action}'.`
        );
    }
    this.markAllDirty();

    return true;
  }

  #update(
    layer: VoxelLayer,
    options: Partial<VoxelLayerConfigurableOptions>
  ): void {
    if (options.properties) {
      layer.properties = structuredClone(options.properties);
    }
    if (options.visible !== undefined) {
      this.#updateLayerVisibility(layer, options.visible);
    }
    if (
      options.compositing !== undefined &&
      options.compositing !== layer.compositing
    ) {
      layer.compositing = options.compositing;
      this.markAllDirty();
    }
  }

  #clone(
    layer: VoxelLayer,
    options: VoxelLayerCloneOptions
  ): VoxelLayerStructureCommand {
    const resolved: VoxelLayerCloneOptions = {
      ...options,
      name: this.uniqueLayerName(options.name)
    };
    const clone = layer.clone({
      ...resolved,
      id: this.#layers.nextId(`${layer.id}_`)
    });

    this.#layers.insert(this.#layers.indexOf(layer.name), clone);
    this.markAllDirty();

    return {
      action: "cloned",
      layerName: layer.name,
      metadata: { options: resolved }
    };
  }

  #moveTo(
    name: string,
    toIndex: number
  ): VoxelLayerStructureCommand | null {
    const index = this.#layers.indexOf(name);
    const clamped = Math.min(
      Math.max(Math.trunc(toIndex), 0),
      this.#layers.size - 1
    );
    if (index === -1 || !this.#layers.move(index, clamped)) {
      return null;
    }
    this.markAllDirty();

    return {
      action: "layer-moved",
      layerName: name,
      metadata: { toIndex: clamped }
    };
  }

  #merge(
    source: VoxelLayer,
    targetName: string
  ): boolean {
    const target = this.getLayer(targetName);
    if (!target || source === target) {
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

    return true;
  }

  #compositedLayerAt(
    position: Vector3Like
  ): VoxelLayer | undefined {
    return this.#layers.toArray().find(
      (layer) => layer.visible &&
        layer.getPackedVoxelAt(position) !== VOXEL_ABSENT
    );
  }

  #updateLayerVisibility(
    layer: VoxelLayer,
    visible: boolean
  ): void {
    if (layer.visible === visible) {
      layer.markAllDirty();

      return;
    }

    layer.visible = visible;
    this.markAllDirty();
  }
}

function voxelSetCommand(
  layerName: string,
  options: VoxelSetOptions
): VoxelEditCommand {
  const { position, blockId } = options;

  return {
    action: "voxel-set",
    layerName,
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
      return voxelSetCommand(command.layerName, command.metadata);
    case "layer-transformed":
      return {
        action: "layer-transformed",
        layerName: command.layerName,
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
