// Import Third-party Dependencies
import {
  arbitrated,
  JSON_CONTENT_TYPE,
  JsonAssetFile,
  NO_OPTIONS_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  ENVIRONMENT_ASSET,
  ENVIRONMENT_COMMAND,
  ENVIRONMENT_EXTENSION,
  ENVIRONMENT_KIND
} from "./environment.ts";
import {
  environmentWriteKeys,
  EnvironmentState
} from "../model/EnvironmentState.ts";
import {
  environmentCommandProtocol,
  environmentFileSchema
} from "../network/EnvironmentCommand.schema.ts";
import type { EnvironmentNetworkCommand } from "../network/types.ts";

// CONSTANTS
export const ENVIRONMENT_FILE = new JsonAssetFile({
  kind: ENVIRONMENT_KIND,
  schema: environmentFileSchema
});

export function environmentAssetKind(): AssetKindHandler<
  EnvironmentState,
  EnvironmentNetworkCommand
> {
  return {
    kind: ENVIRONMENT_KIND,
    extensions: {
      [ENVIRONMENT_EXTENSION]: JSON_CONTENT_TYPE
    },
    build: {
      build: (state) => Promise.resolve(
        new TextEncoder().encode(JSON.stringify(state.snapshot()))
      )
    },

    create(): EnvironmentState {
      return new EnvironmentState();
    },

    load(
      state: EnvironmentState,
      content: Uint8Array
    ): void {
      state.load(ENVIRONMENT_FILE.decode(content));
    },

    clear(
      state: EnvironmentState
    ): void {
      state.clear();
    },

    serialize(
      state: EnvironmentState
    ): Promise<Uint8Array> {
      return Promise.resolve(
        ENVIRONMENT_FILE.encode(state.snapshot())
      );
    },

    commands: {
      eventType: ENVIRONMENT_COMMAND,
      protocol: environmentCommandProtocol,

      apply(state, command) {
        state.applyCommand(command);
      },

      live({ state }) {
        return {
          snapshotSchema: environmentFileSchema,
          snapshot: () => state.snapshot(),
          ...arbitrated(state, {
            accepts: () => true,
            writes: (command) => {
              return {
                keys: environmentWriteKeys(command)
              };
            }
          })
        };
      }
    }
  };
}

export const ASSET_KINDS: AssetKindPackage = {
  descriptors: [ENVIRONMENT_ASSET],
  optionsSchema: NO_OPTIONS_SCHEMA,
  handlers: () => [environmentAssetKind()]
};
