// Import Internal Dependencies
import {
  UVRegion,
  type UVRegionData
} from "./UVRegion.ts";

/**
 * Mirrors the client UV map while retaining region instances for commands.
 */
export class UVRegionCollection implements Iterable<UVRegion> {
  #regions = new Map<string, UVRegion>();

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

  remove(
    id: string
  ): void {
    this.#regions.delete(id);
  }

  [Symbol.iterator](): IterableIterator<UVRegion> {
    return this.#regions.values();
  }
}
