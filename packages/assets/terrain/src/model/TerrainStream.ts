// Import Third-party Dependencies
import type {
  ChunkCoord,
  ChunkKey,
  Terrain
} from "@jolly-pixel/terrain.renderer";
import { Emitter } from "@openally/emitt";

// CONSTANTS
export const STREAM_RADIUS = 8;
const kUnloadRadius = STREAM_RADIUS + 1;

export interface ChunkSource {
  subscribe(coords: readonly ChunkCoord[]): void;
  unsubscribe(coords: readonly ChunkCoord[]): void;
}

export type TerrainStreamEvents = {
  loaded: (coord: ChunkCoord) => void;
  unloaded: (coord: ChunkCoord) => void;
};

export class TerrainStream extends Emitter<TerrainStreamEvents> {
  #terrain: Terrain;
  #source: ChunkSource | null = null;
  #centre: ChunkCoord | null = null;
  #subscribed = new Map<ChunkKey, ChunkCoord>();

  constructor(
    terrain: Terrain
  ) {
    super();
    this.#terrain = terrain;
  }

  connect(
    source: ChunkSource
  ): void {
    if (this.#source !== null) {
      throw new Error("The terrain stream already has a chunk source.");
    }

    this.#source = source;
  }

  subscribed(): IterableIterator<ChunkCoord> {
    return this.#subscribed.values();
  }

  isSubscribed(
    coord: ChunkCoord
  ): boolean {
    return this.#subscribed.has(coord.key);
  }

  wants(
    coord: ChunkCoord
  ): boolean {
    if (this.#source === null) {
      return true;
    }

    return this.#centre !== null && within(this.#centre, coord, STREAM_RADIUS);
  }

  follow(
    centre: ChunkCoord
  ): void {
    if (this.#centre?.equals(centre) === true) {
      return;
    }

    this.#centre = centre;
    this.refresh();
  }

  refresh(): void {
    const source = this.#source;
    const centre = this.#centre;
    if (source === null || centre === null) {
      return;
    }

    const dropped: ChunkCoord[] = [];
    for (const coord of [...this.#subscribed.values()]) {
      if (!this.#terrain.knows(coord) || !within(centre, coord, kUnloadRadius)) {
        this.#subscribed.delete(coord.key);
        dropped.push(coord);
      }
    }
    if (dropped.length > 0) {
      source.unsubscribe(dropped);
    }

    const wanted = [...this.#terrain.overview.coords()]
      .filter((coord) => !this.#subscribed.has(coord.key) && within(centre, coord, STREAM_RADIUS))
      .sort((left, right) => squaredDistance(centre, left) - squaredDistance(centre, right));
    for (const coord of wanted) {
      this.#subscribed.set(coord.key, coord);
    }
    if (wanted.length > 0) {
      source.subscribe(wanted);
    }

    for (const { coord } of [...this.#terrain.chunks()]) {
      if (!this.#subscribed.has(coord.key)) {
        this.#terrain.unloadChunk(coord);
        this.emit("unloaded", coord);
      }
    }
  }

  received(
    coord: ChunkCoord,
    heights: Float32Array
  ): void {
    if (!this.#subscribed.has(coord.key) || !this.#terrain.knows(coord)) {
      return;
    }

    this.#terrain.loadChunk(coord, heights);
    this.emit("loaded", coord);
  }
}

function squaredDistance(
  centre: ChunkCoord,
  coord: ChunkCoord
): number {
  return (coord.x - centre.x) ** 2 + (coord.z - centre.z) ** 2;
}

function within(
  centre: ChunkCoord,
  coord: ChunkCoord,
  radius: number
): boolean {
  return squaredDistance(centre, coord) <= radius * radius;
}
