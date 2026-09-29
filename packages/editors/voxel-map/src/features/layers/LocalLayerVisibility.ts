// Import Third-party Dependencies
import type {
  VoxelLayerCommand,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../document/index.ts";
import {
  layerKey,
  objectKey,
  parseLayerKey,
  type LayerRef
} from "../../state/index.ts";
import type { LayerVisibilityStore } from "./LayerVisibilityStore.ts";

export interface LocalLayerVisibilityOptions {
  world: VoxelWorld;
  mapDocument: MapDocumentSignals;
  visibility: LayerVisibilityStore;
}

export class LocalLayerVisibility {
  #world: VoxelWorld;
  #visibility: LayerVisibilityStore;
  #subscriptions: Array<() => void>;

  constructor(
    options: LocalLayerVisibilityOptions
  ) {
    this.#world = options.world;
    this.#visibility = options.visibility;
    this.#subscriptions = [
      options.visibility.subscribe("change", this.#apply),
      options.mapDocument.subscribe("layerUpdated", this.#onLayerUpdated),
      options.mapDocument.subscribe("reset", this.#onReset)
    ];

    this.#applyAll();
  }

  dispose(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  readonly #apply = (
    key: string
  ): void => {
    const ref = parseLayerKey(key);
    if (ref.kind !== "voxel-layer") {
      return;
    }

    const layer = this.#world.getLayer(ref.name);
    if (layer === undefined) {
      return;
    }

    const visible = this.#visibility.resolve(key, layer.visible);
    if (visible !== layer.visible) {
      this.#world.setLayerVisible(ref.name, visible);
    }
  };

  readonly #onReset = (): void => {
    this.#visibility.retain(
      (key) => this.#exists(parseLayerKey(key))
    );
    this.#applyAll();
  };

  readonly #onLayerUpdated = (
    command: VoxelLayerCommand
  ): void => {
    switch (command.action) {
      case "updated":
        if (command.metadata.options.visible !== undefined) {
          this.#apply(voxelLayerKey(command.layerName));
        }
        break;
      case "cloned":
        this.#visibility.copy(
          voxelLayerKey(command.layerName),
          voxelLayerKey(command.metadata.options.name)
        );
        break;
      case "removed":
      case "merged":
        this.#visibility.forget(voxelLayerKey(command.layerName));
        break;
      case "object-layer-removed":
        this.#visibility.retain(
          (key) => !belongsToObjectLayer(parseLayerKey(key), command.layerName)
        );
        break;
      case "object-removed":
        this.#visibility.forget(
          objectKey({
            layerName: command.layerName,
            objectId: command.metadata.objectId
          })
        );
        break;
      case "object-moved":
        this.#visibility.transfer(
          objectKey({
            layerName: command.metadata.fromLayerName,
            objectId: command.metadata.objectId
          }),
          objectKey({
            layerName: command.metadata.toLayerName,
            objectId: command.metadata.objectId
          })
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

  #exists(
    ref: LayerRef
  ): boolean {
    switch (ref.kind) {
      case "voxel-layer":
        return this.#world.getLayer(ref.name) !== undefined;
      case "object-layer":
        return this.#world.objectLayers.get(ref.name) !== undefined;
      default:
        return this.#world.objectLayers.get(ref.layerName)?.objects.some(
          (object) => object.id === ref.objectId
        ) === true;
    }
  }
}

function voxelLayerKey(
  name: string
): string {
  return layerKey({
    kind: "voxel-layer",
    name
  });
}

function belongsToObjectLayer(
  ref: LayerRef,
  layerName: string
): boolean {
  return ref.kind === "object" ?
    ref.layerName === layerName :
    ref.kind === "object-layer" && ref.name === layerName;
}
