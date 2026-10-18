// Import Third-party Dependencies
import {
  CommandDocument,
  type CommandChange,
  type CommandState
} from "@jolly-pixel/history";
import {
  ChunkCoord,
  TerrainDocument,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { encodeHeights } from "../network/heights.ts";
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

export interface TerrainImage {
  readonly x: number;
  readonly z: number;
  readonly heights: string | null;
}

export type TerrainChange = CommandChange<TerrainCommand, TerrainImage>;

export class TerrainCommandDocument extends CommandDocument<
  TerrainCommand,
  TerrainSnapshot,
  TerrainImage
> {
  readonly terrain: TerrainReader;

  constructor() {
    const terrain = new TerrainDocument();
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
}

function terrainState(
  terrain: TerrainDocument
): CommandState<TerrainCommand, TerrainSnapshot, TerrainImage> {
  return {
    accepts: (command) => acceptsTerrainCommand(terrain, command),
    placeable: (command) => command,
    apply: (command) => applyTerrainCommand(terrain, command),
    load: (snapshot) => loadTerrainSnapshot(terrain, snapshot),
    captureImage: ({ x, z }) => {
      return {
        x,
        z,
        heights: encodedHeightsAt(terrain, x, z)
      };
    },
    invert: (command) => {
      if (command.action === "chunk-added") {
        return [{ action: "chunk-removed", x: command.x, z: command.z }];
      }

      const heights = encodedHeightsAt(terrain, command.x, command.z);

      return heights === null ?
        [] :
        [{ action: "chunk-added", x: command.x, z: command.z, heights }];
    },
    restored: (images) => restoreImages(terrainSnapshot(terrain), images)
  };
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
  for (const { x, z, heights } of [...images].reverse()) {
    if (heights === null) {
      chunks.delete(`${x},${z}`);
    }
    else {
      chunks.set(`${x},${z}`, { x, z, heights });
    }
  }

  return {
    chunks: [...chunks.values()]
  };
}
