// Import Internal Dependencies
import type {
  UVRegion
} from "./UVRegion.ts";

export class UVRegionCollection implements Iterable<UVRegion> {
  #regions = new Map<string, UVRegion>();

  get(
    id: string
  ): UVRegion | undefined {
    return this.#regions.get(id);
  }

  set(
    region: UVRegion
  ): void {
    this.#regions.set(region.id, {
      ...region
    });
  }

  remove(
    id: string
  ): void {
    this.#regions.delete(id);
  }

  [Symbol.iterator](): IterableIterator<UVRegion> {
    return this.#regions.values();
  }
}
