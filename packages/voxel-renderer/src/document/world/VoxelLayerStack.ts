// Import Internal Dependencies
import type { VoxelLayer } from "./VoxelLayer.ts";
import {
  compareLayerRanks,
  rankBetween
} from "./layerRank.ts";

export class VoxelLayerStack implements Iterable<VoxelLayer> {
  #layers: VoxelLayer[] = [];
  #detached: VoxelLayer[] = [];

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

  byId(
    id: string
  ): VoxelLayer | undefined {
    return this.#layers.find((layer) => layer.id === id);
  }

  indexOf(
    layer: VoxelLayer
  ): number {
    return this.#layers.indexOf(layer);
  }

  insert(
    layer: VoxelLayer
  ): void {
    this.#layers.push(layer);
    this.#sort();
  }

  rerank(
    layer: VoxelLayer,
    rank: string
  ): void {
    layer.rank = rank;
    this.#sort();
  }

  topRank(): string {
    return rankBetween(this.#layers[0]?.rank ?? null, null);
  }

  rankAbove(
    layer: VoxelLayer
  ): string {
    const index = this.#layers.indexOf(layer);

    return rankBetween(layer.rank, this.#layers[index - 1]?.rank ?? null);
  }

  rankAt(
    layer: VoxelLayer,
    toIndex: number
  ): string {
    const others = this.#layers.filter((other) => other !== layer);
    const index = Math.min(Math.max(Math.trunc(toIndex), 0), others.length);

    return rankBetween(
      others[index]?.rank ?? null,
      others[index - 1]?.rank ?? null
    );
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

  uniqueName(
    base: string,
    except: VoxelLayer | null = null
  ): string {
    const taken = (name: string) => this.#layers.some(
      (layer) => layer !== except && layer.name === name
    );
    if (!taken(base)) {
      return base;
    }

    const root = base.replace(/ \(\d+\)$/, "");
    for (let index = 1; ; index++) {
      const candidate = `${root} (${index})`;
      if (!taken(candidate)) {
        return candidate;
      }
    }
  }

  #sort(): void {
    this.#layers.sort((left, right) => compareLayerRanks(right, left));
    this.#renumber();
  }

  #renumber(): void {
    const lastIndex = this.#layers.length - 1;

    this.#layers.forEach((layer, index) => {
      layer.order = lastIndex - index;
    });
  }
}
