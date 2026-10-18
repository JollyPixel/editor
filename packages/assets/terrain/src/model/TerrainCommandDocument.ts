// Import Third-party Dependencies
import {
  CommandDocument,
  type CommandChange,
  type CommandState
} from "@jolly-pixel/history";
import {
  ChunkCoord,
  TerrainDocument,
  type TerrainReader,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { encodeHeights } from "../network/heights.ts";
import {
  decodeTilePatch,
  encodeTilePatch
} from "../network/tilePatches.ts";
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

export class TerrainCommandDocument extends CommandDocument<
  TerrainCommand,
  TerrainSnapshot,
  TerrainImage
> {
  readonly terrain: TerrainReader;

  #terrain: TerrainDocument;

  constructor() {
    const terrain = new TerrainDocument();
    super(terrainState(terrain));
    this.terrain = terrain;
    this.#terrain = terrain;
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

  writeTiles(
    patches: Iterable<TilePatch>
  ): TilePatch[] {
    const previous: TilePatch[] = [];
    for (const { tile, heights } of patches) {
      previous.push({ tile, heights: this.#terrain.writeTile(tile, heights) });
    }

    return previous;
  }

  commitTiles(
    previous: Iterable<TilePatch>
  ): boolean {
    const stroke = this.writeTiles(
      [...previous].filter(({ tile }) => this.terrain.has(tile.chunk))
    );
    if (stroke.length === 0) {
      return false;
    }

    return this.commit({
      action: "heights-patched",
      tiles: stroke.map(encodeTilePatch)
    });
  }
}

function terrainState(
  terrain: TerrainDocument
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
        tiles: command.tiles.map((encoded) => {
          const { tile } = decodeTilePatch(encoded)!;

          return encodeTilePatch({
            tile,
            heights: terrain.chunk(tile.chunk)!.tileHeights(tile.x, tile.z)
          });
        })
      }];
  }
}

function touchedChunks(
  command: TerrainCommand
): Array<{ x: number; z: number; }> {
  if (command.action !== "heights-patched") {
    return [{ x: command.x, z: command.z }];
  }

  const chunks = new Map<string, { x: number; z: number; }>();
  for (const { x, z } of command.tiles) {
    chunks.set(`${x},${z}`, { x, z });
  }

  return [...chunks.values()];
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
  const chunks = new Map<string, ChunkSnapshot>(
    snapshot.chunks.map((chunk) => [`${chunk.x},${chunk.z}`, chunk])
  );
  for (const image of [...images].reverse()) {
    for (const { x, z, heights } of image) {
      if (heights === null) {
        chunks.delete(`${x},${z}`);
      }
      else {
        chunks.set(`${x},${z}`, { x, z, heights });
      }
    }
  }

  return {
    chunks: [...chunks.values()]
  };
}
