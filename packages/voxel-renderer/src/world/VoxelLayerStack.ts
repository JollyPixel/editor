// Import Internal Dependencies
import type { VoxelLayer } from "./VoxelLayer.ts";

export class VoxelLayerStack implements Iterable<VoxelLayer> {
  #layers: VoxelLayer[] = [];
  #detached: VoxelLayer[] = [];
  #idCounter = 0;

  get size(): number {
    return this.#layers.length;
  }

  [Symbol.iterator](): IterableIterator<VoxelLayer> {
    return this.#layers.values();
  }

  toArray(): readonly VoxelLayer[] {
    return this.#layers;
  }

  at(
    index: number
  ): VoxelLayer | undefined {
    return this.#layers[index];
  }

  get(
    name: string
  ): VoxelLayer | undefined {
    return this.#layers.find((layer) => layer.name === name);
  }

  indexOf(
    name: string
  ): number {
    return this.#layers.findIndex((layer) => layer.name === name);
  }

  insert(
    index: number,
    layer: VoxelLayer
  ): void {
    this.#layers.splice(index, 0, layer);
    this.#renumber();
  }

  move(
    fromIndex: number,
    toIndex: number
  ): boolean {
    if (
      toIndex === fromIndex ||
      toIndex < 0 ||
      toIndex >= this.#layers.length
    ) {
      return false;
    }

    const [layer] = this.#layers.splice(fromIndex, 1);
    this.insert(toIndex, layer);

    return true;
  }

  detach(
    layer: VoxelLayer
  ): void {
    this.#layers.splice(this.#layers.indexOf(layer), 1);
    this.#detached.push(layer);
    this.#renumber();
  }

  drainDetached(): VoxelLayer[] {
    return this.#detached.splice(0);
  }

  clear(): void {
    this.#layers = [];
    this.#detached = [];
  }

  nextId(
    prefix: string
  ): string {
    let id: string;
    do {
      id = `${prefix}${this.#idCounter++}`;
    } while (this.#layers.some((layer) => layer.id === id));

    return id;
  }

  uniqueName(
    base: string
  ): string {
    if (this.get(base) === undefined) {
      return base;
    }

    const root = base.replace(/ \(\d+\)$/, "");
    for (let index = 1; ; index++) {
      const candidate = `${root} (${index})`;
      if (this.get(candidate) === undefined) {
        return candidate;
      }
    }
  }

  #renumber(): void {
    const lastIndex = this.#layers.length - 1;

    this.#layers.forEach((layer, index) => {
      layer.order = lastIndex - index;
    });
  }
}
