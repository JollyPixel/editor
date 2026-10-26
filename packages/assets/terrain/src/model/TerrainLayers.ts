// Import Internal Dependencies
import {
  MAX_TERRAIN_LAYERS,
  TERRAIN_LAYER_SLOTS
} from "../network/TerrainCommand.schema.ts";
import type {
  TerrainLayerChanges,
  TerrainLayerData,
  TerrainLayerProperties,
  TerrainTextureSize
} from "../network/types.ts";

// CONSTANTS
export const DEFAULT_TERRAIN_TEXTURE_SIZE: TerrainTextureSize = 1024;
export const DEFAULT_LAYER_PROPERTIES: Readonly<TerrainLayerProperties> = Object.freeze({
  name: "Layer",
  albedo: null,
  normal: null,
  orm: null,
  tiling: 4,
  triplanar: false,
  stochastic: false,
  heightBlend: false,
  displacementScale: 0
});
export const GROUND_LAYER: Readonly<TerrainLayerData> = Object.freeze({
  ...DEFAULT_LAYER_PROPERTIES,
  id: "ground",
  slot: 0,
  name: "Ground"
});

export interface TerrainLayersReader {
  readonly size: number;
  readonly textureSize: TerrainTextureSize;

  layer(id: string): TerrainLayerData | undefined;
  layers(): TerrainLayerData[];
  slotTaken(slot: number): boolean;
  freeSlot(): number | null;
}

export class TerrainLayers implements TerrainLayersReader {
  textureSize: TerrainTextureSize = DEFAULT_TERRAIN_TEXTURE_SIZE;

  #layers = new Map<string, TerrainLayerData>();

  get size(): number {
    return this.#layers.size;
  }

  layer(
    id: string
  ): TerrainLayerData | undefined {
    const layer = this.#layers.get(id);

    return layer === undefined ? undefined : copyLayer(layer);
  }

  layers(): TerrainLayerData[] {
    return [...this.#layers.values()]
      .sort((left, right) => left.slot - right.slot)
      .map(copyLayer);
  }

  slotTaken(
    slot: number
  ): boolean {
    for (const layer of this.#layers.values()) {
      if (layer.slot === slot) {
        return true;
      }
    }

    return false;
  }

  freeSlot(): number | null {
    if (this.#layers.size >= MAX_TERRAIN_LAYERS) {
      return null;
    }

    const taken = new Set(Array.from(this.#layers.values(), ({ slot }) => slot));
    for (let slot = 0; slot < TERRAIN_LAYER_SLOTS; slot++) {
      if (!taken.has(slot)) {
        return slot;
      }
    }

    return null;
  }

  add(
    layer: TerrainLayerData
  ): void {
    if (this.#layers.has(layer.id)) {
      throw new RangeError(`Terrain already has layer "${layer.id}".`);
    }
    if (this.slotTaken(layer.slot)) {
      throw new RangeError(`Terrain layer slot ${layer.slot} is taken.`);
    }
    this.#layers.set(layer.id, copyLayer(layer));
  }

  update(
    id: string,
    changes: TerrainLayerChanges
  ): void {
    const layer = this.#layers.get(id);
    if (layer === undefined) {
      throw new RangeError(`Terrain has no layer "${id}".`);
    }

    const updated = { ...layer };
    for (const [field, value] of Object.entries(changes)) {
      if (value !== undefined) {
        Object.assign(updated, { [field]: value });
      }
    }
    this.#layers.set(id, copyLayer(updated));
  }

  remove(
    id: string
  ): void {
    this.#layers.delete(id);
  }

  clear(): void {
    this.#layers.clear();
    this.textureSize = DEFAULT_TERRAIN_TEXTURE_SIZE;
  }

  load(
    layers: Iterable<TerrainLayerData>,
    textureSize: TerrainTextureSize
  ): void {
    this.clear();
    for (const layer of layers) {
      this.add(layer);
    }
    this.textureSize = textureSize;
  }
}

export function copyLayer(
  layer: TerrainLayerData
): TerrainLayerData {
  return {
    ...layer,
    albedo: layer.albedo === null ? null : { ...layer.albedo },
    normal: layer.normal === null ? null : { ...layer.normal },
    orm: layer.orm === null ? null : { ...layer.orm }
  };
}
