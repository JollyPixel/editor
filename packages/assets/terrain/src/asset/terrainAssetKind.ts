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
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";
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
  loadChunkSplat,
  loadTerrainManifest,
  terrainManifest
} from "../model/terrainState.ts";
import {
  materialMaps,
  rebindMaterialMaps
} from "../model/materialMaps.ts";
import { GROUND_MATERIAL } from "../model/TerrainMaterials.ts";
import { TerrainModel } from "../model/TerrainModel.ts";
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
  chunkPartIds,
  outsideCommand,
  parseChunkPart,
  touchedParts
} from "../network/chunkParts.ts";
import {
  decodeHeightBytes,
  encodeHeightBytes,
  encodeHeights
} from "../network/heights.ts";
import {
  decodeSplatBytes,
  encodeSplat,
  encodeSplatBytes
} from "../network/splat.ts";
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
  TerrainModel,
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

    create(): TerrainModel {
      const model = new TerrainModel();
      model.terrain.addChunk(new ChunkCoord(0, 0));
      model.materials.add(GROUND_MATERIAL);

      return model;
    },

    load(
      state: TerrainModel,
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
      state: TerrainModel
    ): void {
      state.clear();
    },

    dependencies(
      state: TerrainModel
    ) {
      return materialMaps(state.materials);
    },

    rebind(
      state: TerrainModel,
      idMap: ReadonlyMap<string, string>
    ): void {
      rebindMaterialMaps(state.materials, idMap);
    },

    serialize(
      state: TerrainModel
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
      touched: touchedParts,
      list: (manifest) => decodeTerrainFile(manifest).chunks
        .flatMap(({ x, z }) => chunkPartIds(new ChunkCoord(x, z))),
      load: (state, partId, content) => {
        const part = parseChunkPart(partId);
        if (part?.kind === "splat") {
          const splat = decodeSplatBytes(content);
          if (splat === null) {
            throw new InvalidAssetFileError(TERRAIN_KIND, `part "${partId}" is not a valid splat map`);
          }
          loadChunkSplat(state, part.coord, splat);

          return;
        }

        const heights = decodeHeightBytes(content);
        if (part === null || heights === null) {
          throw new InvalidAssetFileError(
            TERRAIN_KIND,
            `part "${partId}" is not a chunk of valid heights`
          );
        }
        loadChunkHeights(state, part.coord, heights);
      },
      serialize: (state, partId) => {
        const part = parseChunkPart(partId);
        const chunk = part === null ? undefined : state.terrain.chunk(part.coord);
        if (part === null || chunk === undefined) {
          return Promise.reject(new RangeError(`Terrain has no chunk "${partId}".`));
        }

        return Promise.resolve(part.kind === "splat" ?
          encodeSplatBytes(chunk.splat.copy()) :
          encodeHeightBytes(chunk.copyHeights()));
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
          TerrainModel
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
            const admissible = admissibleTiles(state.terrain, command);

            return admissible === null ? null : arbiter.admit(state, admissible);
          },
          correct: (command, admitted) => correctTerrainCommand(state.terrain, command, admitted),
          restore: (command, version) => arbiter.restore(command, version),
          relay: new TerrainLiveRelay(),
          parts: {
            schema: terrainPartSchema,
            part: (partId) => {
              const part = parseChunkPart(partId);
              const chunk = part === null ? undefined : state.terrain.chunk(part.coord);
              if (part === null || chunk === undefined) {
                return null;
              }

              return part.kind === "splat" ?
                encodeSplat(chunk.splat.copy()) :
                encodeHeights(chunk.copyHeights());
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
