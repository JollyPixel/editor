// Import Third-party Dependencies
import {
  ChunkCoord,
  holeBytes,
  MAX_CHUNK_LAYERS,
  tierOfSampleCount,
  type ChunkKey,
  type SplatTexels,
  type Terrain
} from "@jolly-pixel/terrain.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { TerrainPointsOfInterestReader } from "./TerrainPointsOfInterest.ts";

// CONSTANTS
export const STREAM_RADIUS = 8;
const kUnloadRadius = STREAM_RADIUS + 1;
const kReadBatch = 64;

export interface ChunkContents {
  readonly coord: ChunkCoord;
  readonly heights: Float32Array;
  readonly splat: SplatTexels;
  readonly holes: Uint8Array | undefined;
}

export interface ChunkSource {
  subscribe(coords: readonly ChunkCoord[]): void;
  unsubscribe(coords: readonly ChunkCoord[]): void;
  read(coords: readonly ChunkCoord[]): Promise<ChunkContents[]>;
}

export type TerrainStreamEvents = {
  loaded: (coord: ChunkCoord) => void;
  splatLoaded: (coord: ChunkCoord) => void;
  holesLoaded: (coord: ChunkCoord) => void;
  unloaded: (coord: ChunkCoord) => void;
};

export class TerrainStream extends Emitter<TerrainStreamEvents> {
  #terrain: Terrain;
  #pointsOfInterest: TerrainPointsOfInterestReader;
  #source: ChunkSource | null = null;
  #centre: ChunkCoord | null = null;
  #subscribed = new Map<ChunkKey, ChunkCoord>();
  #pinned = new Map<ChunkKey, ChunkCoord>();
  #earlySplat = new Map<ChunkKey, SplatTexels>();
  #earlyHoles = new Map<ChunkKey, Uint8Array>();

  constructor(
    terrain: Terrain,
    pointsOfInterest: TerrainPointsOfInterestReader
  ) {
    super();
    this.#terrain = terrain;
    this.#pointsOfInterest = pointsOfInterest;
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

    return this.#centre !== null &&
      (within(this.#centre, coord, STREAM_RADIUS) || this.#pinned.has(coord.key));
  }

  isPinned(
    coord: ChunkCoord
  ): boolean {
    return this.#pinned.has(coord.key);
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

    this.#pinned = this.#pickPinned(centre);
    const dropped: ChunkCoord[] = [];
    for (const coord of [...this.#subscribed.values()]) {
      const kept = within(centre, coord, kUnloadRadius) || this.#pinned.has(coord.key);
      if (!this.#terrain.knows(coord) || !kept) {
        this.#subscribed.delete(coord.key);
        this.#earlySplat.delete(coord.key);
        this.#earlyHoles.delete(coord.key);
        dropped.push(coord);
      }
    }
    if (dropped.length > 0) {
      source.unsubscribe(dropped);
    }

    const wanted = [...this.#terrain.overview.coords()]
      .filter((coord) => !this.#subscribed.has(coord.key) && within(centre, coord, STREAM_RADIUS))
      .sort((left, right) => squaredDistance(centre, left) - squaredDistance(centre, right))
      .concat([...this.#pinned.values()].filter((coord) => !this.#subscribed.has(coord.key) &&
        !within(centre, coord, STREAM_RADIUS)));
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

  async* read(
    coords: Iterable<ChunkCoord>
  ): AsyncIterableIterator<ChunkContents> {
    const unloaded: ChunkCoord[] = [];
    for (const coord of coords) {
      const chunk = this.#terrain.chunk(coord);
      if (chunk !== undefined) {
        yield {
          coord,
          heights: chunk.copyHeights(),
          splat: chunk.splat.copy(),
          holes: chunk.holes.empty ? undefined : chunk.holes.copy()
        };
      }
      else if (this.#terrain.knows(coord)) {
        unloaded.push(coord);
      }
    }

    for (let start = 0; start < unloaded.length; start += kReadBatch) {
      yield* await this.#source?.read(unloaded.slice(start, start + kReadBatch)) ?? [];
    }
  }

  #pickPinned(
    centre: ChunkCoord
  ): Map<ChunkKey, ChunkCoord> {
    const priorities = new Map<ChunkKey, { coord: ChunkCoord; priority: number; }>();
    for (const { chunks, priority } of this.#pointsOfInterest.pointsOfInterest()) {
      for (const { x, z } of chunks) {
        const coord = new ChunkCoord(x, z);
        const known = priorities.get(coord.key);
        if (this.#terrain.knows(coord) && !within(centre, coord, kUnloadRadius) &&
          (known === undefined || known.priority < priority)) {
          priorities.set(coord.key, { coord, priority });
        }
      }
    }

    const inCircle = [...this.#terrain.overview.coords()]
      .filter((coord) => within(centre, coord, kUnloadRadius)).length;
    const picked = [...priorities.values()]
      .sort((left, right) => right.priority - left.priority ||
        squaredDistance(centre, left.coord) - squaredDistance(centre, right.coord))
      .slice(0, Math.max(0, MAX_CHUNK_LAYERS - inCircle));

    return new Map(picked.map(({ coord }) => [coord.key, coord]));
  }

  received(
    coord: ChunkCoord,
    heights: Float32Array
  ): void {
    if (!this.#subscribed.has(coord.key) || !this.#terrain.knows(coord)) {
      return;
    }

    const splat = this.#earlySplat.get(coord.key);
    const holes = this.#earlyHoles.get(coord.key);
    this.#earlySplat.delete(coord.key);
    this.#earlyHoles.delete(coord.key);
    const fits = holes !== undefined && holeBytes(tierOfSampleCount(heights.length)!) === holes.length;
    this.#terrain.loadChunk(coord, heights, splat, fits ? holes : undefined);
    this.emit("loaded", coord);
  }

  receivedSplat(
    coord: ChunkCoord,
    splat: SplatTexels
  ): void {
    if (!this.#subscribed.has(coord.key) || !this.#terrain.knows(coord)) {
      return;
    }
    if (!this.#terrain.has(coord)) {
      this.#earlySplat.set(coord.key, splat);

      return;
    }

    this.#terrain.loadSplat(coord, splat);
    this.emit("splatLoaded", coord);
  }

  receivedHoles(
    coord: ChunkCoord,
    holes: Uint8Array
  ): void {
    if (!this.#subscribed.has(coord.key) || !this.#terrain.knows(coord)) {
      return;
    }
    if (!this.#terrain.has(coord)) {
      this.#earlyHoles.set(coord.key, holes);

      return;
    }

    if (holeBytes(this.#terrain.chunk(coord)!.tier) !== holes.length) {
      return;
    }

    this.#terrain.loadHoles(coord, holes);
    this.emit("holesLoaded", coord);
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
