// Import Third-party Dependencies
import {
  CommandDocument,
  type CommandChange,
  type CommandState
} from "@jolly-pixel/history";
import {
  ChunkCoord,
  Terrain,
  TileCoord,
  type ChunkKey,
  type TerrainReader,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { touchedChunks } from "../network/chunkParts.ts";
import { encodeHeights } from "../network/heights.ts";
import { patchBatches } from "../network/patchBatches.ts";
import { encodeTilePatch } from "../network/tilePatches.ts";
import type {
  ChunkSnapshot,
  TerrainCommand,
  TerrainSnapshot
} from "../network/types.ts";
import {
  acceptsTerrainCommand,
  applyTerrainCommand,
  loadTerrainSnapshot,
  terrainSnapshot
} from "./terrainState.ts";

export interface ChunkImage {
  readonly x: number;
  readonly z: number;
  readonly heights: string | null;
}

export type TerrainImage = readonly ChunkImage[];

export type TerrainChange = CommandChange<TerrainCommand, TerrainImage>;

export class TerrainDocument extends CommandDocument<
  TerrainCommand,
  TerrainSnapshot,
  TerrainImage
> {
  readonly terrain: TerrainReader;

  constructor() {
    const terrain = new Terrain();
    super(terrainState(terrain));
    this.terrain = terrain;
  }

  addChunk(
    x: number,
    z: number
  ): boolean {
    const coord = new ChunkCoord(x, z);
    if (this.terrain.has(coord)) {
      return false;
    }

    return this.commit({
      action: "chunk-added",
      x,
      z,
      heights: encodeHeights(this.terrain.seedHeights(coord))
    });
  }

  removeChunk(
    x: number,
    z: number
  ): boolean {
    return this.commit({ action: "chunk-removed", x, z });
  }

  patchTiles(
    patches: Iterable<TilePatch>
  ): boolean {
    const tiles = [...patches]
      .filter(({ tile }) => this.terrain.has(tile.chunk))
      .map(encodeTilePatch);
    let committed = false;
    for (const batch of patchBatches(tiles)) {
      committed = this.commit({
        action: "heights-patched",
        tiles: batch
      }) || committed;
    }

    return committed;
  }
}

function terrainState(
  terrain: Terrain
): CommandState<TerrainCommand, TerrainSnapshot, TerrainImage> {
  return {
    accepts: (command) => acceptsTerrainCommand(terrain, command),
    placeable: (command) => command,
    apply: (command) => applyTerrainCommand(terrain, command),
    load: (snapshot) => loadTerrainSnapshot(terrain, snapshot),
    captureImage: (command) => touchedChunks(command).map(({ x, z }) => {
      return {
        x,
        z,
        heights: encodedHeightsAt(terrain, x, z)
      };
    }),
    invert: (command) => invertCommand(terrain, command),
    restored: (images) => restoreImages(terrainSnapshot(terrain), images)
  };
}

function invertCommand(
  terrain: TerrainReader,
  command: TerrainCommand
): TerrainCommand[] {
  switch (command.action) {
    case "chunk-added":
      return [{ action: "chunk-removed", x: command.x, z: command.z }];
    case "chunk-removed": {
      const heights = encodedHeightsAt(terrain, command.x, command.z);

      return heights === null ?
        [] :
        [{ action: "chunk-added", x: command.x, z: command.z, heights }];
    }
    default:
      return [{
        action: "heights-patched",
        tiles: command.tiles.flatMap(({ x, z, tile: index }) => {
          const tile = TileCoord.fromIndex(new ChunkCoord(x, z), index);
          const heights = terrain.chunk(tile.chunk)?.tileHeights(tile.x, tile.z);

          return heights === undefined ? [] : [encodeTilePatch({ tile, heights })];
        })
      }];
  }
}

function encodedHeightsAt(
  terrain: TerrainReader,
  x: number,
  z: number
): string | null {
  const chunk = terrain.chunk(new ChunkCoord(x, z));

  return chunk === undefined ? null : encodeHeights(chunk.copyHeights());
}

function restoreImages(
  snapshot: TerrainSnapshot,
  images: readonly TerrainImage[]
): TerrainSnapshot {
  const chunks = new Map<ChunkKey, ChunkSnapshot>(
    snapshot.chunks.map((chunk) => [new ChunkCoord(chunk.x, chunk.z).key, chunk])
  );
  for (const image of [...images].reverse()) {
    for (const { x, z, heights } of image) {
      const key = new ChunkCoord(x, z).key;
      if (heights === null) {
        chunks.delete(key);
      }
      else {
        chunks.set(key, { x, z, heights });
      }
    }
  }

  return {
    chunks: [...chunks.values()]
  };
}
