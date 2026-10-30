// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  ChunkCoord,
  ChunkKey
} from "../../terrain/ChunkCoord.ts";
import type { ChunkTier } from "../../terrain/chunkTier.ts";
import {
  isOverviewTile,
  OVERVIEW_SAMPLE_COUNT,
  OVERVIEW_SAMPLES
} from "../../terrain/OverviewMap.ts";
import {
  SPLAT_CHANNELS,
  SPLAT_TEXEL_COUNT,
  SPLAT_TEXELS
} from "../../terrain/SplatMap.ts";
import type { TerrainReader } from "../../terrain/Terrain.ts";
import type { TileCoord } from "../../terrain/TileCoord.ts";
import {
  affectedAprons,
  apronSize,
  CHUNK_RECT,
  mergeAprons,
  writeApron,
  writeFineApron,
  type ApronRegion
} from "./heightApron.ts";
import {
  holePyramidSize,
  writeHolePyramid
} from "./holePyramid.ts";

// CONSTANTS
export const MAX_CHUNK_LAYERS = 256;
export const LOOKUP_SIZE = 256;
export const OVERVIEW_TEXTURE_SIZE = LOOKUP_SIZE * OVERVIEW_SAMPLES;
export const TIER_LAYER_STRIDE = 512;
const kSplatLayerBytes = SPLAT_TEXEL_COUNT * SPLAT_CHANNELS;
const kLookupComponents = 4;
const kKnownComponent = 3;
const kFirstRefinedCapacity = 4;

export type RefinedTier = Exclude<ChunkTier, 1>;

export interface TierArrays {
  readonly heights: THREE.DataArrayTexture;
  readonly holes: THREE.DataArrayTexture;
}

export interface ChunkTextureStoreOptions {
  replaced?: (tier: RefinedTier, arrays: TierArrays) => void;
}

interface ChunkLayer {
  readonly layer: number;
  readonly tier: ChunkTier;
  readonly tierLayer: number;
}

export function lookupSlot(
  coord: ChunkCoord
): number {
  const x = ((coord.x % LOOKUP_SIZE) + LOOKUP_SIZE) % LOOKUP_SIZE;
  const z = ((coord.z % LOOKUP_SIZE) + LOOKUP_SIZE) % LOOKUP_SIZE;

  return z * LOOKUP_SIZE + x;
}

export class ChunkTextureStore {
  readonly heights: THREE.DataArrayTexture;
  readonly splatIndices: THREE.DataArrayTexture;
  readonly splatWeights: THREE.DataArrayTexture;
  readonly holes: THREE.DataArrayTexture;
  readonly lookup: THREE.DataTexture;
  readonly overview: THREE.DataTexture;
  readonly overviewMaterials: THREE.DataTexture;

  #terrain: TerrainReader;
  #replaced: NonNullable<ChunkTextureStoreOptions["replaced"]>;
  #layers = new Map<ChunkKey, ChunkLayer>();
  #freeLayers: number[] = [];
  #refined: Record<RefinedTier, RefinedPool>;

  constructor(
    terrain: TerrainReader,
    options: ChunkTextureStoreOptions = {}
  ) {
    this.#terrain = terrain;
    this.#replaced = options.replaced ?? (() => undefined);
    this.heights = createHeightArray(1, MAX_CHUNK_LAYERS);
    this.splatIndices = createSplatArray();
    this.splatWeights = createSplatArray();
    this.holes = createHoleArray(1, MAX_CHUNK_LAYERS);
    this.#refined = {
      2: new RefinedPool(2),
      4: new RefinedPool(4)
    };

    this.lookup = new THREE.DataTexture(
      new Float32Array(LOOKUP_SIZE * LOOKUP_SIZE * kLookupComponents),
      LOOKUP_SIZE,
      LOOKUP_SIZE,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    configureNearest(this.lookup);

    this.overview = new THREE.DataTexture(
      new Float32Array(OVERVIEW_TEXTURE_SIZE * OVERVIEW_TEXTURE_SIZE),
      OVERVIEW_TEXTURE_SIZE,
      OVERVIEW_TEXTURE_SIZE,
      THREE.RedFormat,
      THREE.FloatType
    );
    configureNearest(this.overview);

    this.overviewMaterials = new THREE.DataTexture(
      new Uint8Array(OVERVIEW_TEXTURE_SIZE * OVERVIEW_TEXTURE_SIZE),
      OVERVIEW_TEXTURE_SIZE,
      OVERVIEW_TEXTURE_SIZE,
      THREE.RedFormat,
      THREE.UnsignedByteType
    );
    configureNearest(this.overviewMaterials);
    for (let layer = MAX_CHUNK_LAYERS - 1; layer >= 0; layer--) {
      this.#freeLayers.push(layer);
    }
  }

  get size(): number {
    return this.#layers.size;
  }

  layer(
    coord: ChunkCoord
  ): number | undefined {
    return this.#layers.get(coord.key)?.layer;
  }

  tierLayer(
    coord: ChunkCoord
  ): { tier: ChunkTier; layer: number; } | undefined {
    const entry = this.#layers.get(coord.key);

    return entry === undefined ? undefined : { tier: entry.tier, layer: entry.tierLayer };
  }

  refinedArrays(
    tier: RefinedTier
  ): TierArrays {
    return this.#refined[tier].arrays;
  }

  clear(): void {
    for (const key of [...this.#layers.keys()]) {
      this.#release(key);
    }
    (this.lookup.image.data as Float32Array).fill(0);
    this.lookup.needsUpdate = true;
    (this.overview.image.data as Float32Array).fill(0);
    this.overview.needsUpdate = true;
    (this.overviewMaterials.image.data as Uint8Array).fill(0);
    this.overviewMaterials.needsUpdate = true;
  }

  chunkAdded(
    coord: ChunkCoord
  ): void {
    const chunk = this.#terrain.chunk(coord);
    if (chunk === undefined) {
      throw new Error(`Chunk ${coord.key} does not exist.`);
    }

    if (this.#layers.has(coord.key)) {
      throw new Error(`Chunk ${coord.key} is already in the view.`);
    }

    this.#claimSlot(coord);
    const layer = this.#freeLayers.pop();
    if (layer === undefined) {
      throw new RangeError(`A terrain view holds at most ${MAX_CHUNK_LAYERS} chunks.`);
    }

    this.#place(coord, layer, chunk.tier);
    this.#writeOverview(coord);
    this.#writeSplat(coord);
    this.#writeAprons(affectedAprons(coord, CHUNK_RECT));
  }

  chunkRemoved(
    coord: ChunkCoord
  ): void {
    if (this.#terrain.has(coord)) {
      throw new Error(`Chunk ${coord.key} must leave the terrain before the view.`);
    }

    this.#release(coord.key);
    this.#forgetOrKeep(coord);
    this.#writeAprons(affectedAprons(coord, CHUNK_RECT));
  }

  overviewChanged(
    coords: Iterable<ChunkCoord>
  ): void {
    const regions: ApronRegion[] = [];
    for (const coord of coords) {
      if (this.#layers.has(coord.key)) {
        this.#writeOverview(coord);
      }
      else if (this.#terrain.knows(coord)) {
        this.#claimSlot(coord);
        this.#writeLookup(coord, 0, 1);
        this.#writeOverview(coord);
      }
      else {
        this.#forgetOrKeep(coord);
      }
      regions.push(...affectedAprons(coord, CHUNK_RECT));
    }
    this.#writeAprons(mergeAprons(regions));
  }

  tilesChanged(
    tiles: Iterable<TileCoord>
  ): void {
    const regions: ApronRegion[] = [];
    for (const tile of tiles) {
      if (!this.#layers.has(tile.chunk.key)) {
        continue;
      }
      if (this.#retier(tile.chunk)) {
        regions.push(...affectedAprons(tile.chunk, CHUNK_RECT));
        continue;
      }

      const { x, z, size } = tile.area;
      regions.push(...affectedAprons(tile.chunk, { x, z, width: size, depth: size }));
      if (isOverviewTile(tile)) {
        this.#writeOverview(tile.chunk);
      }
    }
    this.#writeAprons(mergeAprons(regions));
  }

  splatChanged(
    tiles: Iterable<TileCoord>
  ): void {
    for (const coord of uniqueChunks(tiles)) {
      this.#writeSplat(coord);
      this.#writeOverview(coord);
    }
  }

  holesChanged(
    tiles: Iterable<TileCoord>
  ): void {
    for (const coord of uniqueChunks(tiles)) {
      if (this.#retier(coord)) {
        this.#writeAprons(affectedAprons(coord, CHUNK_RECT));
      }
      else {
        this.#writeHoles(coord);
      }
    }
  }

  dispose(): void {
    this.heights.dispose();
    this.splatIndices.dispose();
    this.splatWeights.dispose();
    this.holes.dispose();
    this.#refined[2].dispose();
    this.#refined[4].dispose();
    this.lookup.dispose();
    this.overview.dispose();
    this.overviewMaterials.dispose();
  }

  #place(
    coord: ChunkCoord,
    layer: number,
    tier: ChunkTier
  ): void {
    let tierLayer = layer;
    if (tier !== 1) {
      const pool = this.#refined[tier];
      const claimed = pool.claim();
      tierLayer = claimed.layer;
      if (claimed.grown) {
        this.#replaced(tier, pool.arrays);
      }
    }
    this.#layers.set(coord.key, { layer, tier, tierLayer });
    this.#writeLookup(coord, layer + 1 + (tier === 1 ? 0 : tierLayer * TIER_LAYER_STRIDE), tier);
    this.#writeHoles(coord);
  }

  #retier(
    coord: ChunkCoord
  ): boolean {
    const entry = this.#layers.get(coord.key);
    const chunk = this.#terrain.chunk(coord);
    if (entry === undefined || chunk === undefined || chunk.tier === entry.tier) {
      return false;
    }

    if (entry.tier !== 1) {
      this.#refined[entry.tier].release(entry.tierLayer);
    }
    this.#place(coord, entry.layer, chunk.tier);
    this.#writeOverview(coord);

    return true;
  }

  #release(
    key: ChunkKey
  ): void {
    const entry = this.#layers.get(key);
    if (entry === undefined) {
      return;
    }

    this.#layers.delete(key);
    this.#freeLayers.push(entry.layer);
    if (entry.tier !== 1) {
      this.#refined[entry.tier].release(entry.tierLayer);
    }
  }

  #claimSlot(
    coord: ChunkCoord
  ): void {
    const slot = lookupSlot(coord) * kLookupComponents;
    const lookup = this.lookup.image.data as Float32Array;
    const taken = lookup[slot + kKnownComponent] !== 0 &&
      (lookup[slot + 1] !== coord.x || lookup[slot + 2] !== coord.z);
    if (taken) {
      throw new RangeError(
        `Chunk ${coord.key} shares its lookup slot with chunk ` +
        `${lookup[slot + 1]},${lookup[slot + 2]}; a terrain spans at most ${LOOKUP_SIZE} chunks per axis.`
      );
    }
  }

  #writeLookup(
    coord: ChunkCoord,
    layer: number,
    known: number
  ): void {
    const lookup = this.lookup.image.data as Float32Array;
    lookup.set([layer, coord.x, coord.z, known], lookupSlot(coord) * kLookupComponents);
    this.lookup.needsUpdate = true;
  }

  #forgetOrKeep(
    coord: ChunkCoord
  ): void {
    const slot = lookupSlot(coord) * kLookupComponents;
    const lookup = this.lookup.image.data as Float32Array;
    if (lookup[slot + 1] !== coord.x || lookup[slot + 2] !== coord.z) {
      return;
    }

    if (this.#terrain.knows(coord)) {
      this.#writeLookup(coord, 0, 1);
      this.#writeOverview(coord);
    }
    else {
      lookup.fill(0, slot, slot + kLookupComponents);
      this.lookup.needsUpdate = true;
      this.#writeOverview(
        coord,
        new Float32Array(OVERVIEW_SAMPLE_COUNT),
        new Uint8Array(OVERVIEW_SAMPLE_COUNT)
      );
    }
  }

  #writeOverview(
    coord: ChunkCoord,
    samples = this.#terrain.overview.samples(coord),
    materials = this.#terrain.overview.materials(coord)
  ): void {
    if (samples === undefined) {
      return;
    }

    const data = this.overview.image.data as Float32Array;
    const slots = this.overviewMaterials.image.data as Uint8Array;
    const originX = overviewTexel(coord.x);
    const originZ = overviewTexel(coord.z);
    for (let row = 0; row < OVERVIEW_SAMPLES; row++) {
      const start = (originZ + row) * OVERVIEW_TEXTURE_SIZE + originX;
      data.set(samples.subarray(row * OVERVIEW_SAMPLES, (row + 1) * OVERVIEW_SAMPLES), start);
      if (materials !== undefined) {
        slots.set(materials.subarray(row * OVERVIEW_SAMPLES, (row + 1) * OVERVIEW_SAMPLES), start);
      }
    }
    this.overview.needsUpdate = true;
    this.overviewMaterials.needsUpdate = true;
  }

  #writeSplat(
    coord: ChunkCoord
  ): void {
    const entry = this.#layers.get(coord.key);
    const chunk = this.#terrain.chunk(coord);
    if (entry === undefined || chunk === undefined) {
      return;
    }

    const { indices, weights } = chunk.splat.copy();
    const offset = entry.layer * kSplatLayerBytes;
    (this.splatIndices.image.data as Uint8Array).set(indices, offset);
    (this.splatWeights.image.data as Uint8Array).set(weights, offset);
    for (const array of [this.splatIndices, this.splatWeights]) {
      array.addLayerUpdate(entry.layer);
      array.needsUpdate = true;
    }
  }

  #writeHoles(
    coord: ChunkCoord
  ): void {
    const entry = this.#layers.get(coord.key);
    const chunk = this.#terrain.chunk(coord);
    if (entry === undefined || chunk === undefined || chunk.tier !== entry.tier) {
      return;
    }

    const holes = this.#tierArrays(entry.tier).holes;
    const { texels } = holePyramidSize(entry.tier);
    const data = holes.image.data as Uint8Array;
    writeHolePyramid(
      chunk.holes,
      data.subarray(entry.tierLayer * texels, (entry.tierLayer + 1) * texels),
      entry.tier
    );
    holes.addLayerUpdate(entry.tierLayer);
    holes.needsUpdate = true;
  }

  #writeAprons(
    regions: Iterable<ApronRegion>
  ): void {
    for (const { coord, samples } of regions) {
      const entry = this.#layers.get(coord.key);
      const chunk = this.#terrain.chunk(coord);
      if (entry === undefined || chunk === undefined || chunk.tier !== entry.tier) {
        continue;
      }

      const heights = this.#tierArrays(entry.tier).heights;
      const size = apronSize(entry.tier) ** 2;
      const apron = (heights.image.data as Float32Array)
        .subarray(entry.tierLayer * size, (entry.tierLayer + 1) * size);
      if (entry.tier === 1) {
        writeApron(this.#terrain, coord, apron, samples);
      }
      else {
        writeFineApron(this.#terrain, coord, apron);
      }
      heights.addLayerUpdate(entry.tierLayer);
      heights.needsUpdate = true;
    }
  }

  #tierArrays(
    tier: ChunkTier
  ): TierArrays {
    return tier === 1 ? this : this.#refined[tier].arrays;
  }
}

class RefinedPool {
  arrays: TierArrays;

  #tier: RefinedTier;
  #capacity = 0;
  #next = 0;
  #free: number[] = [];

  constructor(
    tier: RefinedTier
  ) {
    this.#tier = tier;
    this.arrays = {
      heights: createHeightArray(tier, 1),
      holes: createHoleArray(tier, 1)
    };
  }

  claim(): { layer: number; grown: boolean; } {
    const reused = this.#free.pop();
    if (reused !== undefined) {
      return { layer: reused, grown: false };
    }

    const layer = this.#next++;
    const grown = layer >= this.#capacity;
    if (grown) {
      this.#grow(Math.min(Math.max(kFirstRefinedCapacity, this.#capacity * 2), MAX_CHUNK_LAYERS));
    }

    return { layer, grown };
  }

  release(
    layer: number
  ): void {
    this.#free.push(layer);
  }

  dispose(): void {
    this.arrays.heights.dispose();
    this.arrays.holes.dispose();
  }

  #grow(
    capacity: number
  ): void {
    const heights = createHeightArray(this.#tier, capacity);
    const holes = createHoleArray(this.#tier, capacity);
    if (this.#capacity > 0) {
      (heights.image.data as Float32Array).set(this.arrays.heights.image.data as Float32Array);
      (holes.image.data as Uint8Array).set(this.arrays.holes.image.data as Uint8Array);
    }
    this.dispose();
    this.arrays = { heights, holes };
    this.#capacity = capacity;
  }
}

function uniqueChunks(
  tiles: Iterable<TileCoord>
): IterableIterator<ChunkCoord> {
  const chunks = new Map<ChunkKey, ChunkCoord>();
  for (const { chunk } of tiles) {
    chunks.set(chunk.key, chunk);
  }

  return chunks.values();
}

function overviewTexel(
  chunk: number
): number {
  return (((chunk % LOOKUP_SIZE) + LOOKUP_SIZE) % LOOKUP_SIZE) * OVERVIEW_SAMPLES;
}

function createHeightArray(
  tier: ChunkTier,
  layers: number
): THREE.DataArrayTexture {
  const size = apronSize(tier);
  const array = new THREE.DataArrayTexture(new Float32Array(size * size * layers), size, size, layers);
  array.format = THREE.RedFormat;
  array.type = THREE.FloatType;
  configureNearest(array);

  return array;
}

function createHoleArray(
  tier: ChunkTier,
  layers: number
): THREE.DataArrayTexture {
  const { width, height, texels } = holePyramidSize(tier);
  const array = new THREE.DataArrayTexture(new Uint8Array(texels * layers), width, height, layers);
  array.format = THREE.RedFormat;
  array.type = THREE.UnsignedByteType;
  configureNearest(array);

  return array;
}

function createSplatArray(): THREE.DataArrayTexture {
  const array = new THREE.DataArrayTexture(
    new Uint8Array(kSplatLayerBytes * MAX_CHUNK_LAYERS),
    SPLAT_TEXELS,
    SPLAT_TEXELS,
    MAX_CHUNK_LAYERS
  );
  array.format = THREE.RGBAFormat;
  array.type = THREE.UnsignedByteType;
  configureNearest(array);

  return array;
}

function configureNearest(
  texture: THREE.Texture
): void {
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
}
