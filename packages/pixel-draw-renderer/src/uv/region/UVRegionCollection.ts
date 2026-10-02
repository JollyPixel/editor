// Import Internal Dependencies
import {
  UVRegion,
  type UVRegionData
} from "./UVRegion.ts";

/**
 * Shared id-keyed storage for interactive and headless UV region owners.
 */
export class UVRegionCollection implements Iterable<UVRegion> {
  #regions = new Map<string, UVRegion>();

  get size(): number {
    return this.#regions.size;
  }

  get(
    id: string
  ): UVRegion | undefined {
    return this.#regions.get(id);
  }

  set(
    region: UVRegion | UVRegionData
  ): void {
    const stored = UVRegion.from(region);
    this.#regions.set(
      stored.id,
      stored
    );
  }

  has(
    id: string
  ): boolean {
    return this.#regions.has(id);
  }

  keys(): IterableIterator<string> {
    return this.#regions.keys();
  }

  values(): IterableIterator<UVRegion> {
    return this.#regions.values();
  }

  delete(
    id: string
  ): boolean {
    return this.#regions.delete(id);
  }

  remove(
    id: string
  ): void {
    this.delete(id);
  }

  clear(): void {
    this.#regions.clear();
  }

  [Symbol.iterator](): IterableIterator<UVRegion> {
    return this.#regions.values();
  }
}
