// Import Third-party Dependencies
import {
  ChunkCoord,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  changedFields,
  isLayerCommand,
  TERRAIN_LAYER_FIELDS
} from "../model/layerCommands.ts";
import { CHUNK_TILE_COUNT } from "./TerrainCommand.schema.ts";
import type {
  TerrainCommand,
  TerrainLayerCommand,
  TerrainLayerField
} from "./types.ts";

// CONSTANTS
const kTextureSizeKey = "terrain:texture-size";

export type TerrainWriteRef =
  | { readonly kind: "chunk"; readonly chunk: ChunkCoord; }
  | { readonly kind: "tile"; readonly tile: TileCoord; }
  | {
    readonly kind: "layer";
    readonly id: string;
    readonly field: TerrainLayerField | null;
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

export function terrainLayerKey(
  id: string,
  field: TerrainLayerField | null = null
): string {
  return field === null ? `layer:${id}` : `layer:${id}:${field}`;
}

export function terrainWriteRefKey(
  ref: TerrainWriteRef
): string {
  switch (ref.kind) {
    case "chunk":
      return terrainChunkKey(ref.chunk.x, ref.chunk.z);
    case "tile":
      return terrainHeightTileKey(ref.tile.chunk.x, ref.tile.chunk.z, ref.tile.index);
    case "layer":
      return terrainLayerKey(ref.id, ref.field);
    case "texture-size":
      return kTextureSizeKey;
  }
}

export function terrainWriteRefs(
  command: TerrainCommand
): TerrainWriteRef[] {
  if (isLayerCommand(command)) {
    return layerWriteRefs(command);
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

function layerWriteRefs(
  command: TerrainLayerCommand
): TerrainWriteRef[] {
  switch (command.action) {
    case "layer-updated":
      return changedFields(command.changes).map((field) => {
        return { kind: "layer", id: command.id, field };
      });
    case "texture-size-changed":
      return [{ kind: "texture-size" }];
    default: {
      const id = command.action === "layer-added" ? command.layer.id : command.id;

      return [null, ...TERRAIN_LAYER_FIELDS].map((field) => {
        return { kind: "layer", id, field };
      });
    }
  }
}

export function terrainWriteKeys(
  command: TerrainCommand
): string[] {
  return terrainWriteRefs(command).map(terrainWriteRefKey);
}
