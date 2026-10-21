// Import Third-party Dependencies
import type {
  VoxelLayerCommand,
  VoxelLayerVisibility,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { EditorMapSignals } from "../../map/EditorMap.ts";
import {
  ObjectRef,
  parseLayerRef,
  VoxelLayerRef
} from "../../state/index.ts";
import type { LayerVisibilityStore } from "./LayerVisibilityStore.ts";

export interface LocalLayerVisibilityOptions {
  world: VoxelWorld;
  layers: VoxelLayerVisibility;
  editorMap: EditorMapSignals;
  visibility: LayerVisibilityStore;
}

export class LocalLayerVisibility {
  #world: VoxelWorld;
  #layers: VoxelLayerVisibility;
  #visibility: LayerVisibilityStore;
  #subscriptions: Array<() => void>;
  #concealed = new Set<string>();
  #isolated: string | null = null;

  constructor(
    options: LocalLayerVisibilityOptions
  ) {
    this.#world = options.world;
    this.#layers = options.layers;
    this.#visibility = options.visibility;
    this.#subscriptions = [
      options.visibility.subscribe("change", this.#apply),
      options.editorMap.subscribe("layerUpdated", this.#onLayerUpdated),
      options.editorMap.subscribe("reset", this.#onReset)
    ];

    this.#applyAll();
  }

  conceal(
    layerName: string
  ): () => void {
    this.#concealed.add(layerName);
    this.#layers.override(layerName, false);

    return () => {
      if (this.#concealed.delete(layerName)) {
        this.#apply(new VoxelLayerRef(layerName).key);
      }
    };
  }

  isolate(
    layerName: string
  ): () => void {
    this.#isolated = layerName;
    this.#applyAll();

    return () => {
      if (this.#isolated === layerName) {
        this.#isolated = null;
        this.#applyAll();
      }
    };
  }

  dispose(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  readonly #apply = (
    key: string
  ): void => {
    const ref = parseLayerRef(key);
    if (ref.kind !== "voxel-layer") {
      return;
    }

    const visible = this.#visible(ref.name, key);
    if (visible === undefined) {
      this.#layers.reset(ref.name);
    }
    else {
      this.#layers.override(ref.name, visible);
    }
  };

  readonly #onReset = (): void => {
    this.#visibility.retain(
      (key) => parseLayerRef(key).exists(this.#world)
    );
    this.#layers.clear();
    this.#applyAll();
  };

  readonly #onLayerUpdated = (
    command: VoxelLayerCommand
  ): void => {
    switch (command.action) {
      case "added":
        this.#apply(new VoxelLayerRef(command.metadata.name).key);
        break;
      case "cloned": {
        const clone = new VoxelLayerRef(command.metadata.options.name).key;
        const source = this.#world.getLayerById(command.layerId);
        if (source !== undefined) {
          this.#visibility.copy(new VoxelLayerRef(source.name).key, clone);
        }
        this.#apply(clone);
        break;
      }
      case "removed":
      case "merged":
        this.#visibility.retain(
          (key) => parseLayerRef(key).exists(this.#world)
        );
        break;
      case "object-layer-removed":
        this.#visibility.retain(
          (key) => !parseLayerRef(key).belongsTo(command.layerName)
        );
        break;
      case "object-removed":
        this.#visibility.forget(
          new ObjectRef(command.layerName, command.metadata.objectId).key
        );
        break;
      case "object-moved":
        this.#visibility.transfer(
          new ObjectRef(
            command.metadata.fromLayerName,
            command.metadata.objectId
          ).key,
          new ObjectRef(
            command.metadata.toLayerName,
            command.metadata.objectId
          ).key
        );
        break;
      default:
        break;
    }
  };

  #applyAll(): void {
    for (const layer of this.#world.getLayers()) {
      this.#apply(new VoxelLayerRef(layer.name).key);
    }
  }

  #visible(
    layerName: string,
    key: string
  ): boolean | undefined {
    if (this.#concealed.has(layerName)) {
      return false;
    }
    if (this.#isolated !== null) {
      return layerName === this.#isolated;
    }

    return this.#visibility.visibilityOverride(key);
  }
}
