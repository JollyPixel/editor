// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  ChunkCoord,
  ChunkKey
} from "../../document/ChunkCoord.ts";
import type { TerrainReader } from "../../document/TerrainDocument.ts";
import {
  TILE_SAMPLES,
  type TileCoord
} from "../../document/TileCoord.ts";
import {
  affectedAprons,
  APRON_SIZE,
  APRON_TEXELS,
  CHUNK_RECT,
  mergeAprons,
  writeApron,
  type ApronRegion
} from "./heightApron.ts";

// CONSTANTS
export const MAX_CHUNK_LAYERS = 256;
export const LOOKUP_SIZE = 256;
const kLookupComponents = 4;

export function lookupSlot(
  coord: ChunkCoord
): number {
  const x = ((coord.x % LOOKUP_SIZE) + LOOKUP_SIZE) % LOOKUP_SIZE;
  const z = ((coord.z % LOOKUP_SIZE) + LOOKUP_SIZE) % LOOKUP_SIZE;

  return z * LOOKUP_SIZE + x;
}

export class ChunkTextureStore {
  readonly heights: THREE.DataArrayTexture;
  readonly lookup: THREE.DataTexture;

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

    this.lookup = new THREE.DataTexture(
      new Float32Array(LOOKUP_SIZE * LOOKUP_SIZE * kLookupComponents),
      LOOKUP_SIZE,
      LOOKUP_SIZE,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    configureNearest(this.lookup);
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

    const slot = lookupSlot(coord) * kLookupComponents;
    const lookup = this.lookup.image.data as Float32Array;
    if (lookup[slot] !== 0) {
      throw new RangeError(
        `Chunk ${coord.key} shares its lookup slot with chunk ` +
        `${lookup[slot + 1]},${lookup[slot + 2]}; a terrain spans at most ${LOOKUP_SIZE} chunks per axis.`
      );
    }

    const layer = this.#freeLayers.pop();
    if (layer === undefined) {
      throw new RangeError(`A terrain view holds at most ${MAX_CHUNK_LAYERS} chunks.`);
    }

    this.#layers.set(coord.key, layer);
    lookup.set([layer + 1, coord.x, coord.z, 0], slot);
    this.lookup.needsUpdate = true;
    this.#writeAprons(affectedAprons(coord, CHUNK_RECT));
  }

  chunkRemoved(
    coord: ChunkCoord
  ): void {
    if (this.#terrain.has(coord)) {
      throw new Error(`Chunk ${coord.key} must leave the terrain before the view.`);
    }

    const layer = this.#layers.get(coord.key);
    if (layer === undefined) {
      return;
    }

    this.#layers.delete(coord.key);
    this.#freeLayers.push(layer);
    (this.lookup.image.data as Float32Array).fill(
      0,
      lookupSlot(coord) * kLookupComponents,
      (lookupSlot(coord) + 1) * kLookupComponents
    );
    this.lookup.needsUpdate = true;
    this.#writeAprons(affectedAprons(coord, CHUNK_RECT));
  }

  tilesChanged(
    tiles: Iterable<TileCoord>
  ): void {
    const regions: ApronRegion[] = [];
    for (const tile of tiles) {
      const samples = {
        ...tile.localSample,
        width: TILE_SAMPLES,
        depth: TILE_SAMPLES
      };
      if (this.#layers.has(tile.chunk.key)) {
        regions.push(...affectedAprons(tile.chunk, samples));
      }
    }
    this.#writeAprons(mergeAprons(regions));
  }

  dispose(): void {
    this.heights.dispose();
    this.lookup.dispose();
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

function configureNearest(
  texture: THREE.Texture
): void {
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
}
