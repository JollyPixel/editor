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
  ChunkEntry,
  TerrainCommand,
  TerrainSnapshot
} from "../network/types.ts";
import {
  acceptsTerrainCommand,
  applyTerrainCommand,
  loadTerrainSnapshot,
  terrainSnapshot
} from "./terrainState.ts";
import { TerrainStream } from "./TerrainStream.ts";

export interface ChunkImage {
  readonly x: number;
  readonly z: number;
  /**
   * The chunk's encoded heights, or `null` when it is unloaded or absent.
   */
  readonly heights: string | null;
  /**
   * The encoded overview samples of an unloaded chunk.
   */
  readonly overview?: string;
}

export type TerrainImage = readonly ChunkImage[];

export type TerrainChange = CommandChange<TerrainCommand, TerrainImage>;

export class TerrainDocument extends CommandDocument<
  TerrainCommand,
  TerrainSnapshot,
  TerrainImage
> {
  readonly terrain: TerrainReader;
  readonly stream: TerrainStream;

  constructor() {
    const terrain = new Terrain();
    const stream = new TerrainStream(terrain);
    super(terrainState(terrain, stream));
    this.terrain = terrain;
    this.stream = stream;
    this.on("change", ({ command }) => {
      if (command.action !== "heights-patched") {
        stream.refresh();
      }
    });
    this.on("reset", () => stream.refresh());
  }

  addChunk(
    x: number,
    z: number
  ): boolean {
    const coord = new ChunkCoord(x, z);
    if (this.terrain.knows(coord)) {
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
  terrain: Terrain,
  stream: TerrainStream
): CommandState<TerrainCommand, TerrainSnapshot, TerrainImage> {
  return {
    accepts: (command) => acceptsTerrainCommand(terrain, command),
    placeable: (command) => command,
    apply: (command) => applyTerrainCommand(terrain, command, (coord) => stream.wants(coord)),
    load: (snapshot) => loadTerrainSnapshot(terrain, snapshot),
    captureImage: (command) => touchedChunks(command).map(({ x, z }) => chunkImage(terrain, x, z)),
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

function chunkImage(
  terrain: TerrainReader,
  x: number,
  z: number
): ChunkImage {
  const coord = new ChunkCoord(x, z);
  const overview = terrain.has(coord) ? undefined : terrain.overview.samples(coord);

  return overview === undefined ?
    { x, z, heights: encodedHeightsAt(terrain, x, z) } :
    { x, z, heights: null, overview: encodeHeights(overview) };
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
  const chunks = new Map<ChunkKey, ChunkEntry>(
    snapshot.chunks.map((chunk) => [new ChunkCoord(chunk.x, chunk.z).key, chunk])
  );
  for (const image of [...images].reverse()) {
    for (const chunk of image) {
      const key = new ChunkCoord(chunk.x, chunk.z).key;
      const restored = restoredEntry(chunks.get(key), chunk);
      if (restored === null) {
        chunks.delete(key);
      }
      else {
        chunks.set(key, restored);
      }
    }
  }

  return {
    chunks: [...chunks.values()]
  };
}

function restoredEntry(
  current: ChunkEntry | undefined,
  { x, z, heights, overview }: ChunkImage
): ChunkEntry | null {
  if (heights !== null) {
    return { x, z, heights };
  }
  if (overview === undefined) {
    return null;
  }

  return current?.heights === undefined ? { x, z, overview } : current;
}
