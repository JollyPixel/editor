// Import Third-party Dependencies
import {
  describeErrors,
  KeyedCommandArbiter,
  SchemaParser
} from "@jolly-pixel/network";
import {
  InvalidAssetFileError,
  SNAPSHOT_POLICY_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import {
  ChunkCoord,
  Terrain
} from "@jolly-pixel/terrain.renderer";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  encodeTerrainFile,
  terrainFileSchema,
  TERRAIN_ASSET,
  TERRAIN_COMMAND,
  TERRAIN_FILE_VERSION,
  TERRAIN_EXTENSION,
  TERRAIN_KIND,
  type TerrainFile
} from "./terrain.ts";
import {
  acceptsTerrainCommand,
  applyTerrainCommand,
  loadChunkHeights,
  loadTerrainManifest,
  terrainManifest
} from "../model/terrainState.ts";
import {
  terrainCommandProtocol,
  terrainManifestSchema,
  terrainPartSchema
} from "../network/TerrainCommand.schema.ts";
import {
  admissibleTiles,
  correctTerrainCommand
} from "../network/TerrainCorrection.ts";
import {
  chunkOfPart,
  outsideCommand,
  chunkPartId,
  touchedChunks
} from "../network/chunkParts.ts";
import {
  decodeHeightBytes,
  encodeHeightBytes,
  encodeHeights
} from "../network/heights.ts";
import { terrainWriteKeys } from "../network/TerrainCommandKeys.ts";
import {
  TERRAIN_RELAY_SCHEMAS,
  type TerrainLiveMessage
} from "../network/TerrainLive.schema.ts";
import { TerrainLiveRelay } from "../network/TerrainLiveRelay.ts";
import type { TerrainNetworkCommand } from "../network/types.ts";

// CONSTANTS
export const TERRAIN_PART_EXTENSION = ".bin";
const kOptionsSchema = z.strictObject({
  snapshot: z.optional(SNAPSHOT_POLICY_SCHEMA)
});
const kFileParser = new SchemaParser(terrainFileSchema);

export function decodeTerrainFile(
  content: Uint8Array
): TerrainFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidAssetFileError(
      TERRAIN_KIND,
      "content is not JSON",
      { cause: error }
    );
  }

  const result = kFileParser.parse(parsed);
  if (result.err) {
    throw new InvalidAssetFileError(
      TERRAIN_KIND,
      describeErrors(result.val)
    );
  }

  return result.val;
}

export interface TerrainAssetKindOptions {
  snapshot?: SnapshotPolicy;
}

export function terrainAssetKind(
  options: TerrainAssetKindOptions = {}
): AssetKindHandler<
  Terrain,
  TerrainNetworkCommand,
  TerrainLiveMessage
> {
  const { snapshot } = options;

  return {
    kind: TERRAIN_KIND,
    extensions: {
      [TERRAIN_EXTENSION]: "application/json; charset=utf-8"
    },
    snapshot,

    create(): Terrain {
      const terrain = new Terrain();
      terrain.addChunk(new ChunkCoord(0, 0));

      return terrain;
    },

    load(
      state: Terrain,
      content: Uint8Array
    ): void {
      const file = decodeTerrainFile(content);
      try {
        loadTerrainManifest(state, file);
      }
      catch (error) {
        throw new InvalidAssetFileError(
          TERRAIN_KIND,
          error instanceof Error ? error.message : String(error),
          { cause: error }
        );
      }
    },

    clear(
      state: Terrain
    ): void {
      state.clear();
    },

    serialize(
      state: Terrain
    ): Promise<Uint8Array> {
      return Promise.resolve(
        encodeTerrainFile({
          version: TERRAIN_FILE_VERSION,
          ...terrainManifest(state)
        })
      );
    },

    parts: {
      extension: {
        [TERRAIN_PART_EXTENSION]: "application/octet-stream"
      },
      touched: (command) => touchedChunks(command).map(chunkPartId),
      list: (manifest) => decodeTerrainFile(manifest).chunks
        .map(({ x, z }) => chunkPartId(new ChunkCoord(x, z))),
      load: (state, partId, content) => {
        const coord = chunkOfPart(partId);
        const heights = decodeHeightBytes(content);
        if (coord === null || heights === null) {
          throw new InvalidAssetFileError(
            TERRAIN_KIND,
            `part "${partId}" is not a chunk of valid heights`
          );
        }
        loadChunkHeights(state, coord, heights);
      },
      serialize: (state, partId) => {
        const coord = chunkOfPart(partId);
        const chunk = coord === null ? undefined : state.chunk(coord);
        if (chunk === undefined) {
          return Promise.reject(new RangeError(`Terrain has no chunk "${partId}".`));
        }

        return Promise.resolve(encodeHeightBytes(chunk.copyHeights()));
      }
    },

    commands: {
      eventType: TERRAIN_COMMAND,
      protocol: terrainCommandProtocol,
      relay: TERRAIN_RELAY_SCHEMAS,

      apply(state, command) {
        applyTerrainCommand(state, command);
      },

      live({ state }) {
        const arbiter = new KeyedCommandArbiter<
          TerrainNetworkCommand,
          Terrain
        >({
          accepts: acceptsTerrainCommand,
          writes: (command) => {
            return { keys: terrainWriteKeys(command) };
          }
        });

        return {
          snapshotSchema: terrainManifestSchema,
          snapshot: () => terrainManifest(state),
          arbitrate: (command) => {
            const admissible = admissibleTiles(state, command);

            return admissible === null ? null : arbiter.admit(state, admissible);
          },
          correct: (command, admitted) => correctTerrainCommand(state, command, admitted),
          restore: (command, version) => arbiter.restore(command, version),
          relay: new TerrainLiveRelay(),
          parts: {
            schema: terrainPartSchema,
            part: (partId) => {
              const coord = chunkOfPart(partId);
              const chunk = coord === null ? undefined : state.chunk(coord);

              return chunk === undefined ? null : encodeHeights(chunk.copyHeights());
            },
            outside: outsideCommand
          }
        };
      }
    }
  };
}

export const ASSET_KINDS: AssetKindPackage<TerrainAssetKindOptions> = {
  descriptors: [TERRAIN_ASSET],
  optionsSchema: kOptionsSchema,
  handlers: (options) => [terrainAssetKind(options)]
};
