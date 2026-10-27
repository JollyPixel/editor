// Import Third-party Dependencies
import type { NetworkCommandHeader } from "@jolly-pixel/network";
import {
  CHUNK_SAMPLE_COUNT,
  TILE_SAMPLE_COUNT
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  DEFAULT_MATERIAL_PROPERTIES,
  encodeHeights,
  type TerrainCommand,
  type TerrainMaterialData,
  type TerrainMaterialProperties
} from "#src/index.ts";

let seq = 0;

export function heights(
  height: number
): string {
  return encodeHeights(new Float32Array(CHUNK_SAMPLE_COUNT).fill(height));
}

export function tileHeights(
  height: number
): Float32Array {
  return new Float32Array(TILE_SAMPLE_COUNT).fill(height);
}

export function material(
  id: string,
  slot: number,
  properties: Partial<TerrainMaterialProperties> = {}
): TerrainMaterialData {
  return {
    ...DEFAULT_MATERIAL_PROPERTIES,
    name: id,
    ...properties,
    id,
    slot
  };
}

export function networkCommand<T extends TerrainCommand>(
  command: T,
  overrides: Partial<NetworkCommandHeader> = {}
): T & NetworkCommandHeader {
  seq++;

  return {
    ...command,
    clientId: "client-A",
    seq,
    timestamp: 1000 + seq,
    ...overrides
  };
}
