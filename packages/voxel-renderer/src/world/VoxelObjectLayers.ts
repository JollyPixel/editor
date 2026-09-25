// Import Internal Dependencies
import type {
  VoxelObjectJSON,
  VoxelObjectLayerJSON
} from "../serialization/types.ts";
import type { VoxelLayerCommand } from "../commands.ts";

export type VoxelObjectLayerOptions = Partial<
  Pick<VoxelObjectLayerJSON, "visible" | "order">
>;

/**
 * Named layers of free-standing objects, keyed by layer name. Every change
 * is reported to the emitter as a layer command.
 */
export class VoxelObjectLayers implements Iterable<VoxelObjectLayerJSON> {
  #layers = new Map<string, VoxelObjectLayerJSON>();
  #emit: (command: VoxelLayerCommand) => void;
  #idCounter = 0;

  constructor(
    emit: (command: VoxelLayerCommand) => void
  ) {
    this.#emit = emit;
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
    name: string,
    options: VoxelObjectLayerOptions = {}
  ): VoxelObjectLayerJSON {
    const layer: VoxelObjectLayerJSON = {
      id: this.#nextId(),
      name,
      visible: options.visible ?? true,
      order: options.order ?? this.#layers.size,
      objects: []
    };
    this.#layers.set(name, layer);
    this.#emit({
      action: "object-layer-added",
      layerName: name,
      metadata: {}
    });

    return layer;
  }

  remove(
    name: string
  ): boolean {
    if (!this.#layers.delete(name)) {
      return false;
    }

    this.#emit({
      action: "object-layer-removed",
      layerName: name,
      metadata: {}
    });

    return true;
  }

  update(
    name: string,
    patch: Partial<Pick<VoxelObjectLayerJSON, "visible">>
  ): boolean {
    const layer = this.#layers.get(name);
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

  addObject(
    layerName: string,
    object: VoxelObjectJSON
  ): boolean {
    const layer = this.#layers.get(layerName);
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

  removeObject(
    layerName: string,
    objectId: string
  ): boolean {
    const layer = this.#layers.get(layerName);
    if (!layer) {
      return false;
    }

    const index = layer.objects.findIndex(
      (object) => object.id === objectId
    );
    if (index === -1) {
      return false;
    }

    layer.objects.splice(index, 1);
    this.#emit({
      action: "object-removed",
      layerName,
      metadata: { objectId }
    });

    return true;
  }

  moveObject(
    fromLayerName: string,
    objectId: string,
    toLayerName: string
  ): boolean {
    const from = this.#layers.get(fromLayerName);
    const to = this.#layers.get(toLayerName);
    if (!from || !to || from === to) {
      return false;
    }

    const index = from.objects.findIndex(
      (object) => object.id === objectId
    );
    if (index === -1) {
      return false;
    }

    const [object] = from.objects.splice(index, 1);
    to.objects.push(object);
    this.#emit({
      action: "object-moved",
      layerName: fromLayerName,
      metadata: {
        objectId,
        fromLayerName,
        toLayerName
      }
    });

    return true;
  }

  updateObject(
    layerName: string,
    objectId: string,
    patch: Partial<VoxelObjectJSON>
  ): boolean {
    const object = this.#layers.get(layerName)?.objects.find(
      (candidate) => candidate.id === objectId
    );
    if (!object) {
      return false;
    }

    Object.assign(object, patch);
    this.#emit({
      action: "object-updated",
      layerName,
      metadata: { objectId, patch }
    });

    return true;
  }

  clear(): void {
    this.#layers.clear();
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
