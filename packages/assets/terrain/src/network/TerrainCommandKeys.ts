// Import Third-party Dependencies
import {
  ChunkCoord,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { CHUNK_TILE_COUNT } from "./TerrainCommand.schema.ts";
import type { TerrainCommand } from "./types.ts";

export type TerrainWriteRef =
  | { readonly kind: "chunk"; readonly chunk: ChunkCoord; }
  | { readonly kind: "tile"; readonly tile: TileCoord; };

export function terrainChunkKey(
  x: number,
  z: number
): string {
  return `chunk:${x},${z}`;
}

export function terrainHeightTileKey(
  x: number,
  z: number,
  tile: number
): string {
  return `${terrainChunkKey(x, z)}:h:${tile}`;
}

export function terrainWriteRefKey(
  ref: TerrainWriteRef
): string {
  if (ref.kind === "chunk") {
    return terrainChunkKey(ref.chunk.x, ref.chunk.z);
  }

  return terrainHeightTileKey(ref.tile.chunk.x, ref.tile.chunk.z, ref.tile.index);
}

export function terrainWriteRefs(
  command: TerrainCommand
): TerrainWriteRef[] {
  if (command.action === "heights-patched") {
    return command.tiles.map(({ x, z, tile }) => {
      return {
        kind: "tile",
        tile: TileCoord.fromIndex(new ChunkCoord(x, z), tile)
      };
    });
  }

  const chunk = new ChunkCoord(command.x, command.z);

  return [
    { kind: "chunk", chunk },
    ...Array.from({ length: CHUNK_TILE_COUNT }, (_, index): TerrainWriteRef => {
      return {
        kind: "tile",
        tile: TileCoord.fromIndex(chunk, index)
      };
    })
  ];
}

export function terrainWriteKeys(
  command: TerrainCommand
): string[] {
  return terrainWriteRefs(command).map(terrainWriteRefKey);
}
