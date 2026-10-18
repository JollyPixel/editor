// Import Third-party Dependencies
import type {
  TileKey,
  TilePatch
} from "@jolly-pixel/terrain.renderer";

// CONSTANTS
export const COMMIT_INTERVAL = 2;
export const COMMIT_CHUNKS = 4;
export const COMMIT_TILES = 512;

export class StrokeRecorder {
  #previous = new Map<TileKey, TilePatch>();
  #chunks = new Set<string>();
  #age = 0;

  get size(): number {
    return this.#previous.size;
  }

  get due(): boolean {
    return this.#previous.size > 0 && (
      this.#age >= COMMIT_INTERVAL ||
      this.#chunks.size >= COMMIT_CHUNKS ||
      this.#previous.size >= COMMIT_TILES
    );
  }

  record(
    previous: Iterable<TilePatch>
  ): void {
    for (const patch of previous) {
      if (!this.#previous.has(patch.tile.key)) {
        this.#previous.set(patch.tile.key, patch);
        this.#chunks.add(patch.tile.chunk.key);
      }
    }
  }

  tick(
    elapsed: number
  ): void {
    if (this.#previous.size > 0) {
      this.#age += elapsed;
    }
  }

  take(): TilePatch[] {
    const previous = [...this.#previous.values()];
    this.#previous.clear();
    this.#chunks.clear();
    this.#age = 0;

    return previous;
  }
}
