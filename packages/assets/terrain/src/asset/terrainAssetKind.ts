// Import Third-party Dependencies
import {
  describeErrors,
  SchemaParser,
  type ConflictResolver
} from "@jolly-pixel/network";
import {
  InvalidAssetDocumentError,
  SNAPSHOT_POLICY_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import {
  ChunkCoord,
  TerrainDocument
} from "@jolly-pixel/terrain.renderer";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  encodeTerrainAssetDocument,
  terrainAssetDocumentSchema,
  TERRAIN_ASSET,
  TERRAIN_COMMAND,
  TERRAIN_DOCUMENT_VERSION,
  TERRAIN_EXTENSION,
  TERRAIN_KIND,
  type TerrainAssetDocument
} from "./terrain.ts";
import {
  applyTerrainCommand,
  loadTerrainSnapshot,
  terrainSnapshot
} from "../model/terrainState.ts";
import {
  terrainCommandProtocol,
  terrainSnapshotSchema
} from "../network/TerrainCommand.schema.ts";
import { TerrainCommandArbiter } from "../network/TerrainCommandArbiter.ts";
import { TerrainLiveRelay } from "../network/TerrainLiveRelay.ts";
import type { TerrainNetworkCommand } from "../network/types.ts";

// CONSTANTS
const kOptionsSchema = z.strictObject({
  snapshot: z.optional(SNAPSHOT_POLICY_SCHEMA)
});
const kDocumentParser = new SchemaParser(terrainAssetDocumentSchema);

export function decodeTerrainAssetDocument(
  content: Uint8Array
): TerrainAssetDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidAssetDocumentError(
      TERRAIN_KIND,
      "content is not JSON",
      { cause: error }
    );
  }

  const result = kDocumentParser.parse(parsed);
  if (result.err) {
    throw new InvalidAssetDocumentError(
      TERRAIN_KIND,
      describeErrors(result.val)
    );
  }

  return result.val;
}

export interface TerrainAssetKindOptions {
  snapshot?: SnapshotPolicy;
  conflictResolver?: ConflictResolver<TerrainNetworkCommand>;
}

export function terrainAssetKind(
  options: TerrainAssetKindOptions = {}
): AssetKindHandler<TerrainDocument, TerrainNetworkCommand> {
  const {
    snapshot,
    conflictResolver
  } = options;

  return {
    kind: TERRAIN_KIND,
    extensions: {
      [TERRAIN_EXTENSION]: "application/json; charset=utf-8"
    },
    snapshot,

    create(): TerrainDocument {
      const terrain = new TerrainDocument();
      terrain.addChunk(new ChunkCoord(0, 0));

      return terrain;
    },

    load(
      state: TerrainDocument,
      content: Uint8Array
    ): void {
      const document = decodeTerrainAssetDocument(content);
      try {
        loadTerrainSnapshot(state, document);
      }
      catch (error) {
        throw new InvalidAssetDocumentError(
          TERRAIN_KIND,
          error instanceof Error ? error.message : String(error),
          { cause: error }
        );
      }
    },

    clear(
      state: TerrainDocument
    ): void {
      state.clear();
    },

    serialize(
      state: TerrainDocument
    ): Promise<Uint8Array> {
      return Promise.resolve(
        encodeTerrainAssetDocument({
          version: TERRAIN_DOCUMENT_VERSION,
          ...terrainSnapshot(state)
        })
      );
    },

    commands: {
      eventType: TERRAIN_COMMAND,
      protocol: terrainCommandProtocol,

      apply(state, command) {
        applyTerrainCommand(state, command);
      },

      live({ state }) {
        const arbiter = new TerrainCommandArbiter({
          conflictResolver
        });

        return {
          snapshotSchema: terrainSnapshotSchema,
          snapshot: () => terrainSnapshot(state),
          arbitrate: (command) => arbiter.admit(state, command),
          restore: (command, version) => arbiter.restore(command, version),
          relay: new TerrainLiveRelay()
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
