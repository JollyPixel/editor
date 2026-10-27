// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type ChunkKey
} from "./ChunkCoord.ts";
import {
  OverviewMap,
  overviewSamples,
  type OverviewReader
} from "./OverviewMap.ts";
import { SampleBlock } from "./SampleBlock.ts";
import {
  dominantSlot,
  SPLAT_TEXEL_COUNT,
  SplatMap,
  uniformSplat,
  type SplatTexels
} from "./SplatMap.ts";
import {
  CHUNK_SAMPLE_COUNT,
  TerrainChunk
} from "./TerrainChunk.ts";
import type { TileCoord } from "./TileCoord.ts";

export interface TerrainReader {
  readonly size: number;
  readonly overview: OverviewReader;

  chunks(): IterableIterator<TerrainChunk>;
  chunk(coord: ChunkCoord): TerrainChunk | undefined;
  has(coord: ChunkCoord): boolean;
  knows(coord: ChunkCoord): boolean;
  touches(coord: ChunkCoord): boolean;
  sampleAt(sampleX: number, sampleZ: number): number;
  sampleBlock(coord: ChunkCoord): SampleBlock;
  seedHeights(coord: ChunkCoord): Float32Array;
}

export class Terrain implements TerrainReader {
  readonly overview = new OverviewMap();

  #chunks = new Map<ChunkKey, TerrainChunk>();

  get size(): number {
    return this.#chunks.size;
  }

  chunks(): IterableIterator<TerrainChunk> {
    return this.#chunks.values();
  }

  chunk(
    coord: ChunkCoord
  ): TerrainChunk | undefined {
    return this.#chunks.get(coord.key);
  }

  has(
    coord: ChunkCoord
  ): boolean {
    return this.#chunks.has(coord.key);
  }

  knows(
    coord: ChunkCoord
  ): boolean {
    return this.overview.has(coord);
  }

  touches(
    coord: ChunkCoord
  ): boolean {
    return coord.neighbours().some((neighbour) => this.knows(neighbour));
  }

  addChunk(
    coord: ChunkCoord,
    heights: Float32Array = this.seedHeights(coord),
    splat: SplatTexels = uniformSplat(SPLAT_TEXEL_COUNT)
  ): TerrainChunk {
    if (this.knows(coord)) {
      throw new Error(`Chunk ${coord.key} already exists.`);
    }

    return this.#load(coord, heights, splat);
  }

  addUnloadedChunk(
    coord: ChunkCoord,
    samples: Float32Array,
    materials?: Uint8Array
  ): void {
    if (this.knows(coord)) {
      throw new Error(`Chunk ${coord.key} already exists.`);
    }

    this.overview.set(coord, samples, materials);
  }

  loadChunk(
    coord: ChunkCoord,
    heights: Float32Array,
    splat?: SplatTexels
  ): TerrainChunk {
    if (!this.knows(coord)) {
      throw new Error(`Chunk ${coord.key} does not exist.`);
    }

    return this.#load(coord, heights, splat ?? this.#chunks.get(coord.key)?.splat.copy());
  }

  loadSplat(
    coord: ChunkCoord,
    splat: SplatTexels
  ): void {
    const chunk = this.#chunks.get(coord.key);
    if (chunk === undefined) {
      throw new Error(`Chunk ${coord.key} is not loaded.`);
    }

    chunk.splat.load(splat);
    this.overview.writeMaterials(coord, chunk.splat.overviewMaterials());
  }

  unloadChunk(
    coord: ChunkCoord
  ): TerrainChunk | undefined {
    const chunk = this.#chunks.get(coord.key);
    this.#chunks.delete(coord.key);

    return chunk;
  }

  removeChunk(
    coord: ChunkCoord
  ): TerrainChunk | undefined {
    const chunk = this.#chunks.get(coord.key);
    this.#chunks.delete(coord.key);
    this.overview.delete(coord);

    return chunk;
  }

  clear(): void {
    this.#chunks.clear();
    this.overview.clear();
  }

  writeTile(
    tile: TileCoord,
    heights: Float32Array
  ): Float32Array {
    const chunk = this.#chunks.get(tile.chunk.key);
    if (chunk === undefined) {
      throw new Error(`Chunk ${tile.chunk.key} does not exist.`);
    }

    const previous = chunk.tileHeights(tile.x, tile.z);
    chunk.writeTile(tile.x, tile.z, heights);
    this.overview.writeTile(tile, heights);

    return previous;
  }

  writeOverviewTile(
    tile: TileCoord,
    heights: Float32Array
  ): boolean {
    if (this.has(tile.chunk)) {
      throw new Error(`Chunk ${tile.chunk.key} is loaded; write its tile instead.`);
    }

    return this.overview.writeTile(tile, heights);
  }

  writeSplatTile(
    tile: TileCoord,
    splat: SplatTexels
  ): SplatTexels {
    const chunk = this.#chunks.get(tile.chunk.key);
    if (chunk === undefined) {
      throw new Error(`Chunk ${tile.chunk.key} does not exist.`);
    }

    const previous = chunk.splat.tile(tile.x, tile.z);
    chunk.splat.writeTile(tile.x, tile.z, splat);
    this.overview.writeTileMaterial(tile, dominantSlot(splat, 0));

    return previous;
  }

  writeOverviewSplatTile(
    tile: TileCoord,
    splat: SplatTexels
  ): boolean {
    if (this.has(tile.chunk)) {
      throw new Error(`Chunk ${tile.chunk.key} is loaded; write its splat tile instead.`);
    }

    return this.overview.writeTileMaterial(tile, dominantSlot(splat, 0));
  }

  sampleAt(
    sampleX: number,
    sampleZ: number
  ): number {
    const coord = ChunkCoord.containing(sampleX, sampleZ);
    const overview = this.has(coord) ? undefined : this.overview.interpolate(sampleX, sampleZ);

    return overview ?? this.sampleBlock(coord).height(sampleX, sampleZ);
  }

  sampleBlock(
    coord: ChunkCoord
  ): SampleBlock {
    return new SampleBlock(this, coord);
  }

  seedHeights(
    coord: ChunkCoord
  ): Float32Array {
    const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
    if (this.size === 0) {
      return heights;
    }

    const block = this.sampleBlock(coord);
    const source = block.heightRange === null ? this.#nearestSamples() : block;
    const origin = coord.originSample;
    for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
      for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
        heights[localZ * CHUNK_SAMPLES + localX] =
          source.height(origin.x + localX, origin.z + localZ);
      }
    }

    return heights;
  }

  #load(
    coord: ChunkCoord,
    heights: Float32Array,
    splat: SplatTexels | undefined
  ): TerrainChunk {
    const chunk = new TerrainChunk(coord, heights, new SplatMap(splat));
    const materials = splat === undefined ?
      this.overview.materials(coord) :
      chunk.splat.overviewMaterials();
    this.#chunks.set(coord.key, chunk);
    this.overview.set(coord, overviewSamples(chunk), materials);

    return chunk;
  }

  #nearestSamples(): Pick<SampleBlock, "height"> {
    return {
      height: (sampleX, sampleZ) => this.#nearestChunk(sampleX, sampleZ)
        ?.nearestHeight(sampleX, sampleZ) ?? 0
    };
  }

  #nearestChunk(
    sampleX: number,
    sampleZ: number
  ): TerrainChunk | undefined {
    let nearest: TerrainChunk | undefined;
    let nearestDistance = Infinity;
    for (const chunk of this.#chunks.values()) {
      const distance = chunk.squaredDistanceTo(sampleX, sampleZ);
      if (distance < nearestDistance) {
        nearest = chunk;
        nearestDistance = distance;
      }
    }

    return nearest;
  }
}
