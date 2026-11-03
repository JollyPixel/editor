// Import Third-party Dependencies
import {
  InvalidAssetFileError,
  SNAPSHOT_OPTIONS_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { readScriptOutline } from "#outliner";
import {
  SCRIPT_ASSET,
  SCRIPT_COMMAND,
  SCRIPT_CONTENT_TYPES,
  SCRIPT_KIND,
  SCRIPT_TEMPLATE
} from "./script.ts";
import { ScriptText } from "./ScriptText.ts";
import { TextEdit } from "../text/TextEdit.ts";
import {
  SCRIPT_RELAY_SCHEMAS,
  scriptCommandProtocol,
  type ScriptOutlineRequest
} from "../network/ScriptCommand.schema.ts";
import { ScriptLive } from "../network/ScriptLive.ts";
import type { ScriptNetworkCommand } from "../network/types.ts";
import {
  ScriptOutlineRelay,
  type ScriptOutlineReader
} from "../outline/ScriptOutlineRelay.ts";

// CONSTANTS
const kDecoder = new TextDecoder("utf-8", { fatal: true });
const kEncoder = new TextEncoder();

export interface ScriptAssetKindOptions {
  snapshot?: SnapshotPolicy;
  readOutline?: ScriptOutlineReader;
}

export function scriptAssetKind(
  options: ScriptAssetKindOptions = {}
): AssetKindHandler<ScriptText, ScriptNetworkCommand, ScriptOutlineRequest> {
  const {
    snapshot,
    readOutline = readScriptOutline
  } = options;

  return {
    kind: SCRIPT_KIND,
    extensions: SCRIPT_CONTENT_TYPES,
    snapshot,

    create(): ScriptText {
      return new ScriptText(SCRIPT_TEMPLATE);
    },

    load(
      state: ScriptText,
      content: Uint8Array
    ): void {
      let text: string;
      try {
        text = kDecoder.decode(content);
      }
      catch (cause) {
        throw new InvalidAssetFileError(
          SCRIPT_KIND,
          "content is not UTF-8 text",
          { cause }
        );
      }

      state.replace(text.replaceAll("\r\n", "\n"));
    },

    clear(
      state: ScriptText
    ): void {
      state.replace("");
    },

    serialize(
      state: ScriptText
    ): Promise<Uint8Array> {
      return Promise.resolve(kEncoder.encode(state.text));
    },

    commands: {
      eventType: SCRIPT_COMMAND,
      protocol: scriptCommandProtocol,
      relay: SCRIPT_RELAY_SCHEMAS,

      apply(state, command) {
        try {
          state.edit(new TextEdit(command.changes));
        }
        catch (error) {
          console.error("Script edit skipped", error);
        }
      },

      live(binding) {
        return new ScriptLive(binding, {
          relay: new ScriptOutlineRelay(binding.state, readOutline)
        });
      }
    }
  };
}

export const ASSET_KINDS: AssetKindPackage<Pick<ScriptAssetKindOptions, "snapshot">> = {
  descriptors: [SCRIPT_ASSET],
  optionsSchema: SNAPSHOT_OPTIONS_SCHEMA,
  handlers: (options) => [scriptAssetKind(options)]
};
