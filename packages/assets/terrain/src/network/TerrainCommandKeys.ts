// Import Third-party Dependencies
import {
  CHUNK_TIERS,
  ChunkCoord,
  TileCoord,
  type ChunkTier
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  isMaterialCommand,
  materialWriteRefs,
  type TerrainMaterialWriteRef
} from "../model/materialCommands.ts";
import {
  isPoiCommand,
  poiWriteRefs,
  type PoiWriteRef
} from "../model/poiCommands.ts";
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
  | { readonly kind: "tier"; readonly chunk: ChunkCoord; }
  | {
    readonly kind: "tile";
    readonly channel: ChunkChannel;
    readonly tile: TileCoord;
  }
  | TerrainMaterialWriteRef
  | PoiWriteRef;

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
  tile: number,
  tier: ChunkTier = 1
): string {
  return `${terrainChunkKey(x, z)}:${kChannelTags[channel]}${tier === 1 ? "" : tier}:${tile}`;
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
    case "tier":
      return `${terrainChunkKey(ref.chunk.x, ref.chunk.z)}:tier`;
    case "tile":
      return terrainTileKey(ref.channel, ref.tile.chunk.x, ref.tile.chunk.z, ref.tile.index, ref.tile.tier);
    case "material":
      return terrainMaterialKey(ref.id, ref.field);
    case "texture-size":
      return kTextureSizeKey;
    case "poi":
      return ref.field === null ? `poi:${ref.id}` : `poi:${ref.id}:${ref.field}`;
  }
}

export function terrainWriteRefs(
  command: TerrainCommand
): TerrainWriteRef[] {
  if (isMaterialCommand(command)) {
    return materialWriteRefs(command);
  }
  if (isPoiCommand(command)) {
    return poiWriteRefs(command);
  }
  if (isTilePatchCommand(command)) {
    const channel = tileChannel(command);

    return patchedTiles(command).map((tile): TerrainWriteRef => {
      return { kind: "tile", channel, tile };
    });
  }

  const chunk = new ChunkCoord(command.x, command.z);
  const channels = command.action === "tier-changed" ?
    CHUNK_CHANNELS.filter((channel) => channel !== "splat") :
    CHUNK_CHANNELS;
  const refs: TerrainWriteRef[] = [
    { kind: "tier", chunk },
    ...channels.flatMap((channel) => chunkTileRefs(chunk, channel))
  ];

  return command.action === "tier-changed" ? refs : [{ kind: "chunk", chunk }, ...refs];
}

export function terrainWriteKeys(
  command: TerrainCommand
): string[] {
  return terrainWriteRefs(command).map(terrainWriteRefKey);
}

function chunkTileRefs(
  chunk: ChunkCoord,
  channel: ChunkChannel
): TerrainWriteRef[] {
  const tiers = channel === "splat" ? [1 as const] : CHUNK_TIERS;

  return tiers.flatMap((tier) => TileCoord.all(chunk, tier).map((tile): TerrainWriteRef => {
    return { kind: "tile", channel, tile };
  }));
}
