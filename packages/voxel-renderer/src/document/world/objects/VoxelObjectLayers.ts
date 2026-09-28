// Import Internal Dependencies
import type {
  VoxelObjectJSON,
  VoxelObjectLayerJSON
} from "./types.ts";
import type {
  VoxelLayerCommand,
  VoxelObjectLayerCommand
} from "../../commands/types.ts";

export type VoxelObjectLayerDispatch = (
  command: VoxelObjectLayerCommand
) => VoxelLayerCommand | null;

/**
 * Named layers of free-standing objects, keyed by layer name. Every change
 * is dispatched to the world as a layer command.
 */
export class VoxelObjectLayers implements Iterable<VoxelObjectLayerJSON> {
  #layers = new Map<string, VoxelObjectLayerJSON>();
  #dispatch: VoxelObjectLayerDispatch;
  #idCounter = 0;

  constructor(
    dispatch: VoxelObjectLayerDispatch
  ) {
    this.#dispatch = dispatch;
  }

  get size(): number {
    return this.#layers.size;
  }

  [Symbol.iterator](): IterableIterator<VoxelObjectLayerJSON> {
    return this.#layers.values();
  }

  toArray(): VoxelObjectLayerJSON[] {
    return [...this.#layers.values()];
  }

  get(
    name: string
  ): VoxelObjectLayerJSON | undefined {
    return this.#layers.get(name);
  }

  add(
    name: string
  ): VoxelObjectLayerJSON {
    this.#dispatch({
      action: "object-layer-added",
      layerName: name,
      metadata: {}
    });

    return this.#layers.get(name)!;
  }

  remove(
    name: string
  ): boolean {
    return this.#dispatch({
      action: "object-layer-removed",
      layerName: name,
      metadata: {}
    }) !== null;
  }

  update(
    name: string,
    patch: Partial<Pick<VoxelObjectLayerJSON, "visible">>
  ): boolean {
    return this.#dispatch({
      action: "object-layer-updated",
      layerName: name,
      metadata: { patch }
    }) !== null;
  }

  addObject(
    layerName: string,
    object: VoxelObjectJSON
  ): boolean {
    return this.#dispatch({
      action: "object-added",
      layerName,
      metadata: { object }
    }) !== null;
  }

  removeObject(
    layerName: string,
    objectId: string
  ): boolean {
    return this.#dispatch({
      action: "object-removed",
      layerName,
      metadata: { objectId }
    }) !== null;
  }

  moveObject(
    fromLayerName: string,
    objectId: string,
    toLayerName: string
  ): boolean {
    return this.#dispatch({
      action: "object-moved",
      layerName: fromLayerName,
      metadata: {
        objectId,
        fromLayerName,
        toLayerName
      }
    }) !== null;
  }

  updateObject(
    layerName: string,
    objectId: string,
    patch: Partial<VoxelObjectJSON>
  ): boolean {
    return this.#dispatch({
      action: "object-updated",
      layerName,
      metadata: { objectId, patch }
    }) !== null;
  }

  apply(
    command: VoxelObjectLayerCommand
  ): VoxelObjectLayerCommand | null {
    const changed = this.#change(command);

    return changed ? command : null;
  }

  restore(
    layers: Iterable<VoxelObjectLayerJSON>
  ): void {
    this.#layers.clear();
    for (const layer of layers) {
      this.#layers.set(layer.name, {
        ...layer,
        objects: [...layer.objects]
      });
    }
  }

  clear(): void {
    this.#layers.clear();
  }

  #change(
    command: VoxelObjectLayerCommand
  ): boolean {
    const { layerName } = command;

    switch (command.action) {
      case "object-layer-added":
        this.#layers.set(layerName, {
          id: this.#nextId(),
          name: layerName,
          visible: true,
          order: this.#layers.size,
          objects: []
        });

        return true;
      case "object-layer-removed":
        return this.#layers.delete(layerName);
      case "object-layer-updated": {
        const layer = this.#layers.get(layerName);
        if (layer && command.metadata.patch.visible !== undefined) {
          layer.visible = command.metadata.patch.visible;
        }

        return layer !== undefined;
      }
      case "object-added": {
        const layer = this.#layers.get(layerName);
        layer?.objects.push(command.metadata.object);

        return layer !== undefined;
      }
      case "object-removed":
        return this.#takeObject(layerName, command.metadata.objectId) !== null;
      case "object-moved": {
        const { fromLayerName, objectId, toLayerName } = command.metadata;
        const to = this.#layers.get(toLayerName);
        if (to === undefined || fromLayerName === toLayerName) {
          return false;
        }
        const object = this.#takeObject(fromLayerName, objectId);
        if (object !== null) {
          to.objects.push(object);
        }

        return object !== null;
      }
      case "object-updated": {
        const object = this.#layers.get(layerName)?.objects.find(
          (candidate) => candidate.id === command.metadata.objectId
        );
        if (object) {
          Object.assign(object, command.metadata.patch);
        }

        return object !== undefined;
      }
      default: {
        const unhandled: never = command;
        throw new Error(
          `VoxelObjectLayers: unhandled action '${(unhandled as VoxelObjectLayerCommand).action}'.`
        );
      }
    }
  }

  #takeObject(
    layerName: string,
    objectId: string
  ): VoxelObjectJSON | null {
    const objects = this.#layers.get(layerName)?.objects ?? [];
    const index = objects.findIndex((object) => object.id === objectId);

    return index === -1 ? null : objects.splice(index, 1)[0];
  }

  #nextId(): string {
    const ids = new Set(
      Array.from(this.#layers.values(), (layer) => layer.id)
    );

    let id: string;
    do {
      id = `obj_layer_${this.#idCounter++}`;
    } while (ids.has(id));

    return id;
  }
}
