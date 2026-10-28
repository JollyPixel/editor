// Import Third-party Dependencies
import { InvalidEntryError } from "@jolly-pixel/asset.common";
import {
  DEFAULT_MATERIAL_TEXTURE_SIZE,
  MATERIAL_SLOT_COUNT
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { MAX_TERRAIN_MATERIALS } from "../network/TerrainCommand.schema.ts";
import type {
  TerrainMaterialChanges,
  TerrainMaterialData,
  TerrainMaterialProperties,
  TerrainTextureSize
} from "../network/types.ts";
import { changedFields } from "./materialCommands.ts";

// CONSTANTS
export const DEFAULT_MATERIAL_PROPERTIES: Readonly<TerrainMaterialProperties> = Object.freeze({
  name: "Material",
  albedo: null,
  normal: null,
  orm: null,
  height: null,
  tiling: 4,
  triplanar: false,
  stochastic: false,
  heightBlend: false,
  displacementScale: 0
});
export const GROUND_MATERIAL: Readonly<TerrainMaterialData> = Object.freeze({
  ...DEFAULT_MATERIAL_PROPERTIES,
  id: "ground",
  slot: 0,
  name: "Ground"
});

export interface TerrainMaterialsReader {
  readonly size: number;
  readonly textureSize: TerrainTextureSize;

  material(id: string): TerrainMaterialData | undefined;
  materials(): TerrainMaterialData[];
  materialAt(slot: number): TerrainMaterialData | undefined;
  freeSlot(): number | null;
}

export class TerrainMaterials implements TerrainMaterialsReader {
  textureSize: TerrainTextureSize = DEFAULT_MATERIAL_TEXTURE_SIZE;

  #materials = new Map<string, TerrainMaterialData>();

  get size(): number {
    return this.#materials.size;
  }

  material(
    id: string
  ): TerrainMaterialData | undefined {
    const material = this.#materials.get(id);

    return material === undefined ? undefined : copyMaterial(material);
  }

  materials(): TerrainMaterialData[] {
    return [...this.#materials.values()]
      .sort((left, right) => left.slot - right.slot)
      .map(copyMaterial);
  }

  materialAt(
    slot: number
  ): TerrainMaterialData | undefined {
    for (const material of this.#materials.values()) {
      if (material.slot === slot) {
        return copyMaterial(material);
      }
    }

    return undefined;
  }

  freeSlot(): number | null {
    if (this.#materials.size >= MAX_TERRAIN_MATERIALS) {
      return null;
    }

    const taken = new Set(Array.from(this.#materials.values(), ({ slot }) => slot));
    for (let slot = 0; slot < MATERIAL_SLOT_COUNT; slot++) {
      if (!taken.has(slot)) {
        return slot;
      }
    }

    return null;
  }

  add(
    material: TerrainMaterialData
  ): void {
    if (this.#materials.has(material.id)) {
      throw new InvalidEntryError("material", material.id, "is listed twice");
    }
    if (this.materialAt(material.slot) !== undefined) {
      throw new InvalidEntryError("material", material.id, `takes the used slot ${material.slot}`);
    }
    this.#materials.set(material.id, copyMaterial(material));
  }

  update(
    id: string,
    changes: TerrainMaterialChanges
  ): void {
    const material = this.#materials.get(id);
    if (material === undefined) {
      throw new RangeError(`Terrain has no material "${id}".`);
    }

    const updated = { ...material };
    for (const field of changedFields(changes)) {
      Object.assign(updated, { [field]: changes[field] });
    }
    this.#materials.set(id, copyMaterial(updated));
  }

  remove(
    id: string
  ): void {
    this.#materials.delete(id);
  }

  clear(): void {
    this.#materials.clear();
    this.textureSize = DEFAULT_MATERIAL_TEXTURE_SIZE;
  }

  load(
    materials: Iterable<TerrainMaterialData>,
    textureSize: TerrainTextureSize
  ): void {
    this.clear();
    for (const material of materials) {
      this.add(material);
    }
    this.textureSize = textureSize;
  }
}

export function copyMaterial(
  material: TerrainMaterialData
): TerrainMaterialData {
  return {
    ...material,
    albedo: copyMap(material.albedo),
    normal: copyMap(material.normal),
    orm: copyMap(material.orm),
    height: copyMap(material.height)
  };
}

function copyMap<TMap extends object>(
  map: TMap | null
): TMap | null {
  return map === null ? null : { ...map };
}
