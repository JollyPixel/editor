// Import Third-party Dependencies
import {
  tierOfHoleBytes,
  type ChunkCoord,
  type TerrainChunk,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { TerrainModel } from "../model/TerrainModel.ts";
import { parseChunkPart } from "../network/chunkParts.ts";
import {
  decodeChunkHeightBytes,
  encodeHeightBytes
} from "../network/heights.ts";
import {
  decodeSplatBytes,
  encodeSplatBytes
} from "../network/splat.ts";
import type { ChunkChannel } from "../network/tilePatchCommands.ts";

// CONSTANTS
const kCodecs: Readonly<Record<ChunkChannel, ChunkPartCodec>> = {
  heights: {
    encode: (chunk) => encodeHeightBytes(chunk.copyHeights()),
    load: ({ terrain }, coord, content) => {
      const heights = decodeChunkHeightBytes(content);
      if (heights === null) {
        return false;
      }
      if (terrain.knows(coord)) {
        terrain.loadChunk(coord, heights);
      }

      return true;
    }
  },
  splat: {
    encode: (chunk) => encodeSplatBytes(chunk.splat.copy()),
    load: ({ terrain }, coord, content) => {
      const splat = decodeSplatBytes(content);
      if (splat === null) {
        return false;
      }
      if (terrain.has(coord)) {
        terrain.loadSplat(coord, splat);
      }

      return true;
    }
  },
  holes: {
    encode: (chunk) => (chunk.holes.empty ? null : chunk.holes.copy()),
    load: ({ terrain }, coord, content) => {
      const tier = tierOfHoleBytes(content.length);
      if (tier === null) {
        return false;
      }
      if (terrain.chunk(coord)?.tier === tier) {
        terrain.loadHoles(coord, content);
      }

      return true;
    }
  }
};

interface ChunkPartCodec {
  encode(chunk: TerrainChunk): Uint8Array | null;
  load(
    model: TerrainModel,
    coord: ChunkCoord,
    content: Uint8Array
  ): boolean;
}

export function encodeChunkPart(
  terrain: TerrainReader,
  partId: string
): Uint8Array | null {
  const part = parseChunkPart(partId);
  const chunk = part === null ? undefined : terrain.chunk(part.coord);

  return part === null || chunk === undefined ? null : kCodecs[part.channel].encode(chunk);
}

export function loadChunkPart(
  model: TerrainModel,
  partId: string,
  content: Uint8Array
): boolean {
  const part = parseChunkPart(partId);

  return part !== null && kCodecs[part.channel].load(model, part.coord, content);
}
