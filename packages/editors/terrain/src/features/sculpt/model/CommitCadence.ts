// Import Third-party Dependencies
import type {
  ChunkKey,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// CONSTANTS
export const COMMIT_INTERVAL = 2;
export const COMMIT_CHUNKS = 4;
export const COMMIT_CHUNKS_INTERVAL = 0.25;

export class CommitCadence {
  #chunks = new Set<ChunkKey>();
  #age = 0;

  get due(): boolean {
    return this.#chunks.size > 0 && (
      this.#age >= COMMIT_INTERVAL ||
      (
        this.#chunks.size >= COMMIT_CHUNKS &&
        this.#age >= COMMIT_CHUNKS_INTERVAL
      )
    );
  }

  touch(
    tiles: Iterable<TileCoord>
  ): void {
    for (const tile of tiles) {
      this.#chunks.add(tile.chunk.key);
    }
  }

  tick(
    elapsed: number
  ): void {
    if (this.#chunks.size > 0) {
      this.#age += elapsed;
    }
  }

  reset(): void {
    this.#chunks.clear();
    this.#age = 0;
  }
}
