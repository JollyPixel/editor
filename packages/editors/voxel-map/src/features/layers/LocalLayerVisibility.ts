// Import Third-party Dependencies
import type {
  VoxelLayerCommand,
  VoxelLayerVisibility,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../document/index.ts";
import {
  ObjectRef,
  parseLayerRef,
  VoxelLayerRef
} from "../../state/index.ts";
import type { LayerVisibilityStore } from "./LayerVisibilityStore.ts";

export interface LocalLayerVisibilityOptions {
  world: VoxelWorld;
  layers: VoxelLayerVisibility;
  mapDocument: MapDocumentSignals;
  visibility: LayerVisibilityStore;
}

export class LocalLayerVisibility {
  #world: VoxelWorld;
  #layers: VoxelLayerVisibility;
  #visibility: LayerVisibilityStore;
  #subscriptions: Array<() => void>;
  #concealed = new Set<string>();

  constructor(
    options: LocalLayerVisibilityOptions
  ) {
    this.#world = options.world;
    this.#layers = options.layers;
    this.#visibility = options.visibility;
    this.#subscriptions = [
      options.visibility.subscribe("change", this.#apply),
      options.mapDocument.subscribe("layerUpdated", this.#onLayerUpdated),
      options.mapDocument.subscribe("reset", this.#onReset)
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

    const visible = this.#concealed.has(ref.name) ?
      false :
      this.#visibility.overrideOf(key);
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
    for (const layerName of this.#concealed) {
      this.#layers.override(layerName, false);
    }
  };

  readonly #onLayerUpdated = (
    command: VoxelLayerCommand
  ): void => {
    switch (command.action) {
      case "cloned":
        this.#visibility.copy(
          new VoxelLayerRef(command.layerName).key,
          new VoxelLayerRef(command.metadata.options.name).key
        );
        break;
      case "removed":
      case "merged":
        this.#visibility.forget(new VoxelLayerRef(command.layerName).key);
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
    for (const key of [...this.#visibility.keys]) {
      this.#apply(key);
    }
  }
}
