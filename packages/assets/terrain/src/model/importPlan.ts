// Import Third-party Dependencies
import {
  HoleMask,
  isOverviewTile,
  resampleHoles,
  SplatMap,
  TerrainChunk,
  TileCoord,
  type ChunkCoord,
  type ChunkKey,
  type ChunkRect,
  type ChunkTier,
  type TerrainReader,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { encodeHeights } from "../network/heights.ts";
import { encodeHoles } from "../network/holes.ts";
import { patchBatches } from "../network/patchBatches.ts";
import { encodeSplatTilePatch } from "../network/splat.ts";
import { currentTier } from "../network/tierCommands.ts";
import { currentTiles } from "../network/tilePatchCommands.ts";
import { encodeTilePatch } from "../network/tilePatches.ts";
import type { TerrainCommand } from "../network/types.ts";
import {
  additionOrder,
  blendSplat,
  chunkBlock,
  chunksInRect,
  fitSplatMasks,
  importRefusal,
  type SplatMask
} from "./terrainExchange.ts";
import type { ChunkContents } from "./TerrainStream.ts";

export interface PairedCommands {
  readonly forward: readonly TerrainCommand[];
  readonly backward: readonly TerrainCommand[];
}

type ImportedTerrain = Pick<TerrainReader, "chunk" | "knows" | "touches" | "overview">;
type CurrentChunks = ReadonlyMap<ChunkKey, TerrainChunk>;

export function heightImportPlan(
  terrain: ImportedTerrain,
  rect: ChunkRect,
  tier: ChunkTier,
  heights: Float32Array,
  before: readonly ChunkContents[]
): PairedCommands[] | null {
  const current = currentChunks(terrain, rect, before);
  const added = additionOrder(terrain, chunksInRect(rect));
  if (current === null || added === null || importRefusal(terrain, rect) !== null) {
    return null;
  }

  const plan = added.map((coord): PairedCommands => {
    const { x, z } = coord;
    const block = encodeHeights(chunkBlock(heights, rect, coord, tier));

    return {
      forward: [{ action: "chunk-added", x, z, heights: block }],
      backward: [{ action: "chunk-removed", x, z }]
    };
  });

  const patches: TilePatch[] = [];
  for (const chunk of current.values()) {
    const block = new TerrainChunk(chunk.coord, chunkBlock(heights, rect, chunk.coord, tier));
    if (chunk.tier === tier) {
      patches.push(...tilePatches(block, false));
    }
    else {
      plan.push({
        forward: [retieredChunk(block, chunk), overviewTiles(block)],
        backward: [currentTier(chunk), overviewTiles(chunk)]
      });
    }
  }

  return [...plan, ...batchPairs(current, patches.map(encodeTilePatch), (tiles) => {
    return { action: "heights-patched", tiles };
  })];
}

export function splatImportPlan(
  terrain: ImportedTerrain,
  rect: ChunkRect,
  masks: readonly SplatMask[],
  before: readonly ChunkContents[]
): PairedCommands[] | null {
  const current = currentChunks(terrain, rect, before);
  if (current === null) {
    return null;
  }

  const fitted = fitSplatMasks(masks, rect);
  const tiles = before.flatMap((chunk) => {
    const splat = new SplatMap(blendSplat(fitted, rect, chunk));

    return TileCoord.all(chunk.coord).map((tile) => encodeSplatTilePatch({
      tile,
      splat: splat.tile(tile.x, tile.z)
    }));
  });

  return batchPairs(current, tiles, (batch) => {
    return { action: "splat-patched", tiles: batch };
  });
}

function currentChunks(
  terrain: ImportedTerrain,
  rect: ChunkRect,
  before: readonly ChunkContents[]
): CurrentChunks | null {
  const chunks = new Map(before.map(({ coord, heights, splat, holes }) => [
    coord.key,
    new TerrainChunk(
      coord,
      heights,
      new SplatMap(splat),
      holes === undefined ? undefined : new HoleMask(holes)
    )
  ]));
  const known = chunksInRect(rect).filter((coord) => terrain.knows(coord));
  const unchanged = known.length === chunks.size && known.every((coord: ChunkCoord) => {
    const chunk = chunks.get(coord.key);

    return chunk !== undefined && (terrain.chunk(coord)?.tier ?? chunk.tier) === chunk.tier;
  });

  return unchanged ? chunks : null;
}

function batchPairs<TTile, TCommand extends TerrainCommand>(
  current: CurrentChunks,
  tiles: readonly TTile[],
  command: (batch: TTile[]) => TCommand & Parameters<typeof currentTiles>[1]
): PairedCommands[] {
  const reader = { chunk: (coord: ChunkCoord) => current.get(coord.key) };

  return Array.from(patchBatches(tiles), (batch) => {
    const forward = command(batch);

    return { forward: [forward], backward: [currentTiles(reader, forward)] };
  });
}

function retieredChunk(
  block: TerrainChunk,
  { holes }: TerrainChunk
): TerrainCommand {
  return {
    action: "tier-changed",
    x: block.coord.x,
    z: block.coord.z,
    tier: block.tier,
    heights: encodeHeights(block.copyHeights()),
    ...(holes.empty ? {} : { holes: encodeHoles(resampleHoles(holes, block.tier)) })
  };
}

function overviewTiles(
  chunk: TerrainChunk
): TerrainCommand {
  return {
    action: "heights-patched",
    tiles: tilePatches(chunk, true).map(encodeTilePatch)
  };
}

function tilePatches(
  chunk: TerrainChunk,
  overviewOnly: boolean
): TilePatch[] {
  return TileCoord.all(chunk.coord, chunk.tier)
    .filter((tile) => !overviewOnly || isOverviewTile(tile))
    .map((tile) => {
      return { tile, heights: chunk.tileHeights(tile.x, tile.z) };
    });
}
