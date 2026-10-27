// Import Third-party Dependencies
import {
  ChunkCoord,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  changedFields,
  isMaterialCommand,
  TERRAIN_MATERIAL_FIELDS
} from "../model/materialCommands.ts";
import { CHUNK_TILE_COUNT } from "./TerrainCommand.schema.ts";
import type {
  TerrainCommand,
  TerrainMaterialCommand,
  TerrainMaterialField
} from "./types.ts";

// CONSTANTS
const kTextureSizeKey = "terrain:texture-size";

export type TerrainWriteRef =
  | { readonly kind: "chunk"; readonly chunk: ChunkCoord; }
  | { readonly kind: "tile"; readonly tile: TileCoord; }
  | {
    readonly kind: "material";
    readonly id: string;
    readonly field: TerrainMaterialField | null;
  }
  | { readonly kind: "texture-size"; };

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
      return terrainHeightTileKey(ref.tile.chunk.x, ref.tile.chunk.z, ref.tile.index);
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

function materialWriteRefs(
  command: TerrainMaterialCommand
): TerrainWriteRef[] {
  switch (command.action) {
    case "material-updated":
      return changedFields(command.changes).map((field) => {
        return { kind: "material", id: command.id, field };
      });
    case "texture-size-changed":
      return [{ kind: "texture-size" }];
    default: {
      const id = command.action === "material-added" ? command.material.id : command.id;

      return [null, ...TERRAIN_MATERIAL_FIELDS].map((field) => {
        return { kind: "material", id, field };
      });
    }
  }
}

export function terrainWriteKeys(
  command: TerrainCommand
): string[] {
  return terrainWriteRefs(command).map(terrainWriteRefKey);
}
