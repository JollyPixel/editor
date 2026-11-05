// Import Third-party Dependencies
import {
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
import type { ScriptText } from "./ScriptText.ts";
import { TEXT_ASSET } from "./text.ts";
import {
  textAssetKind,
  textKindHandler
} from "./textAssetKind.ts";
import {
  SCRIPT_RELAY_SCHEMAS,
  type ScriptOutlineRequest
} from "../network/ScriptCommand.schema.ts";
import type { ScriptNetworkCommand } from "../network/types.ts";
import {
  ScriptOutlineRelay,
  type ScriptOutlineReader
} from "../outline/ScriptOutlineRelay.ts";

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

  return textKindHandler({
    kind: SCRIPT_KIND,
    eventType: SCRIPT_COMMAND,
    extensions: SCRIPT_CONTENT_TYPES,
    template: SCRIPT_TEMPLATE,
    snapshot,
    relay: {
      schemas: SCRIPT_RELAY_SCHEMAS,
      open: (state) => new ScriptOutlineRelay(state, readOutline)
    }
  });
}

export const ASSET_KINDS: AssetKindPackage<Pick<ScriptAssetKindOptions, "snapshot">> = {
  descriptors: [SCRIPT_ASSET, TEXT_ASSET],
  optionsSchema: SNAPSHOT_OPTIONS_SCHEMA,
  handlers: (options) => [scriptAssetKind(options), textAssetKind(options)]
};
