// Import Internal Dependencies
import type {
  TerrainMaterialData,
  TerrainMaterialMap
} from "../network/types.ts";
import type {
  TerrainMaterials,
  TerrainMaterialsReader
} from "./TerrainMaterials.ts";

// CONSTANTS
export const TERRAIN_MATERIAL_MAPS = ["albedo", "normal", "orm", "height"] as const;

export type TerrainMaterialMapKind = typeof TERRAIN_MATERIAL_MAPS[number];

export function materialMaps(
  materials: TerrainMaterialsReader
): TerrainMaterialMap[] {
  const maps = new Map<string, TerrainMaterialMap>();
  for (const material of materials.materials()) {
    for (const map of referencedMaps(material)) {
      maps.set(`${map.kind}:${map.id}`, map);
    }
  }

  return [...maps.values()];
}

export function rebindMaterialMaps(
  materials: TerrainMaterials,
  idMap: ReadonlyMap<string, string>
): void {
  for (const material of materials.materials()) {
    const changes: Partial<Record<TerrainMaterialMapKind, TerrainMaterialMap>> = {};
    for (const kind of TERRAIN_MATERIAL_MAPS) {
      const map = material[kind];
      const id = map === null ? undefined : idMap.get(map.id);
      if (map !== null && id !== undefined) {
        changes[kind] = { ...map, id };
      }
    }
    materials.update(material.id, changes);
  }
}

function referencedMaps(
  material: TerrainMaterialData
): TerrainMaterialMap[] {
  return TERRAIN_MATERIAL_MAPS.flatMap((kind) => {
    const map = material[kind];

    return map === null ? [] : [map];
  });
}
