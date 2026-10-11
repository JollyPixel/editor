// Import Internal Dependencies
import {
  VoxelLayer,
  type VoxelLayerOptions,
  type VoxelLayerUpdate
} from "./VoxelLayer.ts";
import type { VoxelLayerStack } from "./VoxelLayerStack.ts";
import type { VoxelLayerStructureCommand } from "../commands/types.ts";

export type VoxelLayerRestoreOptions = Omit<
  VoxelLayerOptions,
  "chunkSize" | "order"
>;

type StructureCommandOf<TAction extends VoxelLayerStructureCommand["action"]> =
  Extract<VoxelLayerStructureCommand, { action: TAction; }>;

export interface VoxelLayerStructureOptions {
  chunkSize: number;
  layers: VoxelLayerStack;
  markAllDirty: () => void;
}

export class VoxelLayerStructure {
  #chunkSize: number;
  #layers: VoxelLayerStack;
  #markAllDirty: () => void;

  constructor(
    options: VoxelLayerStructureOptions
  ) {
    this.#chunkSize = options.chunkSize;
    this.#layers = options.layers;
    this.#markAllDirty = options.markAllDirty;
  }

  restore(
    options: VoxelLayerRestoreOptions
  ): VoxelLayer {
    const layer = new VoxelLayer({
      ...options,
      rank: options.rank ?? this.#layers.topRank(),
      order: this.#layers.size,
      chunkSize: this.#chunkSize
    });
    this.#layers.insert(layer);

    return layer;
  }

  applyCommand(
    command: VoxelLayerStructureCommand
  ): VoxelLayerStructureCommand | null {
    if (command.action === "added") {
      return this.#add(command);
    }

    const layer = this.#layers.byId(command.layerId);
    if (layer === undefined) {
      return null;
    }

    switch (command.action) {
      case "cloned":
        return this.#clone(layer, command);
      case "updated":
        return this.#update(layer, command);
      case "layer-moved":
        return this.#move(layer, command);
      default:
        return this.#change(layer, command) ? command : null;
    }
  }

  merge(
    source: VoxelLayer,
    target: VoxelLayer
  ): void {
    target.mergeFrom(source, {
      overwrite: source.order > target.order
    });
    target.properties = {
      ...structuredClone(source.properties),
      ...target.properties
    };
    this.#layers.detach(source);
  }

  #add(
    command: StructureCommandOf<"added">
  ): VoxelLayerStructureCommand | null {
    if (this.#layers.byId(command.layerId) !== undefined) {
      return null;
    }

    const { options, rank } = command.metadata;
    const name = this.#layers.uniqueName(command.metadata.name);
    this.restore({
      ...options,
      id: command.layerId,
      name,
      rank
    });

    return {
      ...command,
      metadata: {
        ...command.metadata,
        name
      }
    };
  }

  #clone(
    layer: VoxelLayer,
    command: StructureCommandOf<"cloned">
  ): VoxelLayerStructureCommand | null {
    const { cloneId, rank, options } = command.metadata;
    if (this.#layers.byId(cloneId) !== undefined) {
      return null;
    }

    const name = this.#layers.uniqueName(options.name);
    this.#layers.insert(layer.clone({
      ...options,
      id: cloneId,
      rank,
      name
    }));
    this.#markAllDirty();

    return {
      ...command,
      metadata: {
        ...command.metadata,
        options: {
          ...options,
          name
        }
      }
    };
  }

  #update(
    layer: VoxelLayer,
    command: StructureCommandOf<"updated">
  ): VoxelLayerStructureCommand {
    const options: VoxelLayerUpdate = { ...command.metadata.options };
    if (options.name !== undefined) {
      options.name = this.#layers.uniqueName(options.name, layer);
      layer.name = options.name;
    }
    if (options.properties) {
      layer.properties = structuredClone(options.properties);
    }
    if (options.visible === layer.visible) {
      layer.markAllDirty();
    }
    else if (options.visible !== undefined) {
      layer.visible = options.visible;
      this.#markAllDirty();
    }
    if (
      options.compositing !== undefined &&
      options.compositing !== layer.compositing
    ) {
      layer.compositing = options.compositing;
      this.#markAllDirty();
    }

    return {
      ...command,
      metadata: { options }
    };
  }

  #move(
    layer: VoxelLayer,
    command: StructureCommandOf<"layer-moved">
  ): VoxelLayerStructureCommand | null {
    if (layer.rank === command.metadata.rank) {
      return null;
    }

    this.#layers.rerank(layer, command.metadata.rank);
    this.#markAllDirty();

    return command;
  }

  #change(
    layer: VoxelLayer,
    command: VoxelLayerStructureCommand
  ): boolean {
    switch (command.action) {
      case "removed":
        this.#layers.detach(layer);
        break;
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
      case "merged": {
        const target = this.#layers.byId(command.metadata.targetLayerId);
        if (!target || target === layer) {
          return false;
        }
        this.merge(layer, target);
        break;
      }
      default:
        throw new Error(
          `VoxelWorld: unhandled action '${command.action}'.`
        );
    }
    this.#markAllDirty();

    return true;
  }
}
