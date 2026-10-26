// Import Third-party Dependencies
import type { NetworkCommandHeader } from "@jolly-pixel/network";
import {
  CHUNK_SAMPLE_COUNT,
  TILE_SAMPLE_COUNT
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  DEFAULT_LAYER_PROPERTIES,
  encodeHeights,
  type TerrainCommand,
  type TerrainLayerData,
  type TerrainLayerProperties
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

export function layer(
  id: string,
  slot: number,
  properties: Partial<TerrainLayerProperties> = {}
): TerrainLayerData {
  return {
    ...DEFAULT_LAYER_PROPERTIES,
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
