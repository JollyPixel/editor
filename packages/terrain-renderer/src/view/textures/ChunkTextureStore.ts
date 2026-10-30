// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  ChunkCoord,
  ChunkKey
} from "../../terrain/ChunkCoord.ts";
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
  APRON_SIZE,
  APRON_TEXELS,
  CHUNK_RECT,
  mergeAprons,
  writeApron,
  type ApronRegion
} from "./heightApron.ts";
import {
  HOLE_PYRAMID_HEIGHT,
  HOLE_PYRAMID_TEXELS,
  HOLE_PYRAMID_WIDTH,
  writeHolePyramid
} from "./holePyramid.ts";

// CONSTANTS
export const MAX_CHUNK_LAYERS = 256;
export const LOOKUP_SIZE = 256;
export const OVERVIEW_TEXTURE_SIZE = LOOKUP_SIZE * OVERVIEW_SAMPLES;
const kSplatLayerBytes = SPLAT_TEXEL_COUNT * SPLAT_CHANNELS;
const kLookupComponents = 4;
const kKnownComponent = 3;

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
  #layers = new Map<ChunkKey, number>();
  #freeLayers: number[] = [];

  constructor(
    terrain: TerrainReader
  ) {
    this.#terrain = terrain;
    this.heights = new THREE.DataArrayTexture(
      new Float32Array(APRON_TEXELS * MAX_CHUNK_LAYERS),
      APRON_SIZE,
      APRON_SIZE,
      MAX_CHUNK_LAYERS
    );
    this.heights.format = THREE.RedFormat;
    this.heights.type = THREE.FloatType;
    configureNearest(this.heights);
    this.splatIndices = createSplatArray();
    this.splatWeights = createSplatArray();
    this.holes = new THREE.DataArrayTexture(
      new Uint8Array(HOLE_PYRAMID_TEXELS * MAX_CHUNK_LAYERS),
      HOLE_PYRAMID_WIDTH,
      HOLE_PYRAMID_HEIGHT,
      MAX_CHUNK_LAYERS
    );
    this.holes.format = THREE.RedFormat;
    this.holes.type = THREE.UnsignedByteType;
    configureNearest(this.holes);

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
    return this.#layers.get(coord.key);
  }

  clear(): void {
    for (const layer of this.#layers.values()) {
      this.#freeLayers.push(layer);
    }
    this.#layers.clear();
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
    if (!this.#terrain.has(coord)) {
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

    this.#layers.set(coord.key, layer);
    this.#writeLookup(coord, layer + 1, 1);
    this.#writeOverview(coord);
    this.#writeSplat(coord);
    this.#writeHoles(coord);
    this.#writeAprons(affectedAprons(coord, CHUNK_RECT));
  }

  chunkRemoved(
    coord: ChunkCoord
  ): void {
    if (this.#terrain.has(coord)) {
      throw new Error(`Chunk ${coord.key} must leave the terrain before the view.`);
    }

    const layer = this.#layers.get(coord.key);
    if (layer !== undefined) {
      this.#layers.delete(coord.key);
      this.#freeLayers.push(layer);
    }
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
      const { x, z, size } = tile.area;
      const samples = {
        x,
        z,
        width: size,
        depth: size
      };
      if (this.#layers.has(tile.chunk.key)) {
        regions.push(...affectedAprons(tile.chunk, samples));
        if (isOverviewTile(tile)) {
          this.#writeOverview(tile.chunk);
        }
      }
    }
    this.#writeAprons(mergeAprons(regions));
  }

  splatChanged(
    tiles: Iterable<TileCoord>
  ): void {
    const chunks = new Map<ChunkKey, ChunkCoord>();
    for (const { chunk } of tiles) {
      chunks.set(chunk.key, chunk);
    }
    for (const coord of chunks.values()) {
      this.#writeSplat(coord);
      this.#writeOverview(coord);
    }
  }

  holesChanged(
    tiles: Iterable<TileCoord>
  ): void {
    const chunks = new Map<ChunkKey, ChunkCoord>();
    for (const { chunk } of tiles) {
      chunks.set(chunk.key, chunk);
    }
    for (const coord of chunks.values()) {
      this.#writeHoles(coord);
    }
  }

  dispose(): void {
    this.heights.dispose();
    this.splatIndices.dispose();
    this.splatWeights.dispose();
    this.holes.dispose();
    this.lookup.dispose();
    this.overview.dispose();
    this.overviewMaterials.dispose();
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
    const layer = this.#layers.get(coord.key);
    const chunk = this.#terrain.chunk(coord);
    if (layer === undefined || chunk === undefined) {
      return;
    }

    const { indices, weights } = chunk.splat.copy();
    const offset = layer * kSplatLayerBytes;
    (this.splatIndices.image.data as Uint8Array).set(indices, offset);
    (this.splatWeights.image.data as Uint8Array).set(weights, offset);
    for (const array of [this.splatIndices, this.splatWeights]) {
      array.addLayerUpdate(layer);
      array.needsUpdate = true;
    }
  }

  #writeHoles(
    coord: ChunkCoord
  ): void {
    const layer = this.#layers.get(coord.key);
    const chunk = this.#terrain.chunk(coord);
    if (layer === undefined || chunk === undefined) {
      return;
    }

    const data = this.holes.image.data as Uint8Array;
    writeHolePyramid(
      { isHole: (quadX, quadZ) => chunk.holeAt(quadX, quadZ) },
      data.subarray(layer * HOLE_PYRAMID_TEXELS, (layer + 1) * HOLE_PYRAMID_TEXELS)
    );
    this.holes.addLayerUpdate(layer);
    this.holes.needsUpdate = true;
  }

  #writeAprons(
    regions: Iterable<ApronRegion>
  ): void {
    const data = this.heights.image.data as Float32Array;
    for (const { coord, samples } of regions) {
      const layer = this.#layers.get(coord.key);
      if (layer !== undefined) {
        const apron = data.subarray(layer * APRON_TEXELS, (layer + 1) * APRON_TEXELS);
        writeApron(this.#terrain, coord, apron, samples);
        this.heights.addLayerUpdate(layer);
        this.heights.needsUpdate = true;
      }
    }
  }
}

function overviewTexel(
  chunk: number
): number {
  return (((chunk % LOOKUP_SIZE) + LOOKUP_SIZE) % LOOKUP_SIZE) * OVERVIEW_SAMPLES;
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
