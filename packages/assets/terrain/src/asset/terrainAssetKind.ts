// Import Third-party Dependencies
import {
  arbitrated,
  InvalidAssetFileError,
  JSON_CONTENT_TYPE,
  JsonAssetFile,
  SNAPSHOT_OPTIONS_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import { InvalidEntryError } from "@jolly-pixel/asset.common";
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  terrainFileSchema,
  TERRAIN_ASSET,
  TERRAIN_COMMAND,
  TERRAIN_FILE_VERSION,
  TERRAIN_EXTENSION,
  TERRAIN_KIND
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
export const TERRAIN_FILE = new JsonAssetFile({
  kind: TERRAIN_KIND,
  schema: terrainFileSchema,
  isInvalid: (error) => error instanceof InvalidEntryError
});

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
      [TERRAIN_EXTENSION]: JSON_CONTENT_TYPE
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
      TERRAIN_FILE.load(content, (file) => loadTerrainManifest(state, file));
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
        TERRAIN_FILE.encode({
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
      list: (manifest) => TERRAIN_FILE.decode(manifest).chunks
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
        const { arbitrate, restore } = arbitrated<TerrainNetworkCommand, TerrainModel>(state, {
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

            return admissible === null ? null : arbitrate(admissible);
          },
          correct: (command, admitted) => correctTerrainCommand(state.terrain, command, admitted),
          restore,
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
  optionsSchema: SNAPSHOT_OPTIONS_SCHEMA,
  handlers: (options) => [terrainAssetKind(options)]
};
