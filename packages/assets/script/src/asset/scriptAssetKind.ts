// Import Third-party Dependencies
import {
  SNAPSHOT_OPTIONS_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import {
  buildScript,
  readScriptOutline
} from "@jolly-pixel/scripting";

// Import Internal Dependencies
import {
  SCRIPT_ASSET,
  SCRIPT_COMMAND,
  SCRIPT_CONTENT_TYPES,
  SCRIPT_KIND,
  SCRIPT_TEMPLATE
} from "./script.ts";
import { SHADER_ASSET } from "./shader.ts";
import { shaderAssetKind } from "./shaderAssetKind.ts";
import { TEXT_ASSET } from "./text.ts";
import {
  textAssetKind,
  textKindHandler
} from "./textAssetKind.ts";
import type { ScriptText } from "../model/ScriptText.ts";
import {
  SCRIPT_RELAY_SCHEMAS,
  type ScriptOutlineRequest
} from "../network/ScriptCommand.schema.ts";
import type { ScriptNetworkCommand } from "../network/types.ts";
import {
  ScriptOutlineRelay,
  type ScriptOutlineReader
} from "../network/ScriptOutlineRelay.ts";

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
    compile: buildScript,
    relay: {
      schemas: SCRIPT_RELAY_SCHEMAS,
      open: (state) => new ScriptOutlineRelay(state, readOutline)
    }
  });
}

export const ASSET_KINDS: AssetKindPackage<Pick<ScriptAssetKindOptions, "snapshot">> = {
  descriptors: [SCRIPT_ASSET, TEXT_ASSET, SHADER_ASSET],
  optionsSchema: SNAPSHOT_OPTIONS_SCHEMA,
  handlers: (options) => [
    scriptAssetKind(options),
    textAssetKind(options),
    shaderAssetKind(options)
  ]
};
