// Import Internal Dependencies
import type {
  TerrainLayerData,
  TerrainLayerMap
} from "../network/types.ts";
import type {
  TerrainLayers,
  TerrainLayersReader
} from "./TerrainLayers.ts";

// CONSTANTS
const kMapFields = ["albedo", "normal", "orm"] as const;

export function layerMaps(
  layers: TerrainLayersReader
): TerrainLayerMap[] {
  const maps = new Map<string, TerrainLayerMap>();
  for (const layer of layers.layers()) {
    for (const map of referencedMaps(layer)) {
      maps.set(`${map.kind}:${map.id}`, map);
    }
  }

  return [...maps.values()];
}

export function rebindLayerMaps(
  layers: TerrainLayers,
  idMap: ReadonlyMap<string, string>
): void {
  for (const layer of layers.layers()) {
    const changes: Partial<Record<typeof kMapFields[number], TerrainLayerMap>> = {};
    for (const field of kMapFields) {
      const map = layer[field];
      const id = map === null ? undefined : idMap.get(map.id);
      if (map !== null && id !== undefined) {
        changes[field] = { ...map, id };
      }
    }
    layers.update(layer.id, changes);
  }
}

function referencedMaps(
  layer: TerrainLayerData
): TerrainLayerMap[] {
  return kMapFields.flatMap((field) => {
    const map = layer[field];

    return map === null ? [] : [map];
  });
}
