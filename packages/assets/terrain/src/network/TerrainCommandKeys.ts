// Import Third-party Dependencies
import {
  ChunkCoord,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  isMaterialCommand,
  materialWriteRefs,
  type TerrainMaterialWriteRef
} from "../model/materialCommands.ts";
import { CHUNK_TILE_COUNT } from "./TerrainCommand.schema.ts";
import {
  CHUNK_CHANNELS,
  isTilePatchCommand,
  patchedTiles,
  tileChannel,
  type ChunkChannel
} from "./tilePatchCommands.ts";
import type {
  TerrainCommand,
  TerrainMaterialField
} from "./types.ts";

// CONSTANTS
const kTextureSizeKey = "terrain:texture-size";
const kChannelTags: Readonly<Record<ChunkChannel, string>> = {
  heights: "h",
  splat: "s",
  holes: "x"
};

export type TerrainWriteRef =
  | { readonly kind: "chunk"; readonly chunk: ChunkCoord; }
  | {
    readonly kind: "tile";
    readonly channel: ChunkChannel;
    readonly tile: TileCoord;
  }
  | TerrainMaterialWriteRef;

export function terrainChunkKey(
  x: number,
  z: number
): string {
  return `chunk:${x},${z}`;
}

export function terrainTileKey(
  channel: ChunkChannel,
  x: number,
  z: number,
  tile: number
): string {
  return `${terrainChunkKey(x, z)}:${kChannelTags[channel]}:${tile}`;
}

export function terrainMaterialKey(
  id: string,
  field: TerrainMaterialField | null = null
): string {
  return field === null ? `material:${id}` : `material:${id}:${field}`;
}

export function terrainWriteRefKey(
  ref: TerrainWriteRef
): string {
  switch (ref.kind) {
    case "chunk":
      return terrainChunkKey(ref.chunk.x, ref.chunk.z);
    case "tile":
      return terrainTileKey(ref.channel, ref.tile.chunk.x, ref.tile.chunk.z, ref.tile.index);
    case "material":
      return terrainMaterialKey(ref.id, ref.field);
    case "texture-size":
      return kTextureSizeKey;
  }
}

export function terrainWriteRefs(
  command: TerrainCommand
): TerrainWriteRef[] {
  if (isMaterialCommand(command)) {
    return materialWriteRefs(command);
  }
  if (isTilePatchCommand(command)) {
    const channel = tileChannel(command);

    return patchedTiles(command).map((tile): TerrainWriteRef => {
      return { kind: "tile", channel, tile };
    });
  }

  const chunk = new ChunkCoord(command.x, command.z);
  const tiles = Array.from({ length: CHUNK_TILE_COUNT }, (_, index) => TileCoord.fromIndex(chunk, index));

  return [
    { kind: "chunk", chunk },
    ...CHUNK_CHANNELS.flatMap((channel) => tiles.map((tile): TerrainWriteRef => {
      return { kind: "tile", channel, tile };
    }))
  ];
}

export function terrainWriteKeys(
  command: TerrainCommand
): string[] {
  return terrainWriteRefs(command).map(terrainWriteRefKey);
}
