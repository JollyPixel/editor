// Import Third-party Dependencies
import {
  NO_OPTIONS_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage
} from "@jolly-pixel/asset-server";
import {
  buildScript,
  lintScript,
  readScriptOutline
} from "@jolly-pixel/scripting";

// Import Internal Dependencies
import {
  SCRIPT_ASSET,
  SCRIPT_COMMAND,
  SCRIPT_CONTENT_TYPES,
  SCRIPT_KIND
} from "./script.ts";
import { scriptTemplate } from "./scriptTemplate.ts";
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
  type ScriptRelayRequest
} from "../network/ScriptCommand.schema.ts";
import {
  ScriptLintRelay,
  type ScriptLinter
} from "../network/ScriptLintRelay.ts";
import {
  ScriptOutlineRelay,
  type ScriptOutlineReader
} from "../network/ScriptOutlineRelay.ts";
import { ScriptRelay } from "../network/ScriptRelay.ts";
import type { ScriptNetworkCommand } from "../network/types.ts";

export interface ScriptAssetKindOptions {
  readOutline?: ScriptOutlineReader;
  lint?: ScriptLinter;
}

export function scriptAssetKind(
  options: ScriptAssetKindOptions = {}
): AssetKindHandler<ScriptText, ScriptNetworkCommand, ScriptRelayRequest> {
  const {
    readOutline = readScriptOutline,
    lint = lintScript
  } = options;

  return textKindHandler({
    kind: SCRIPT_KIND,
    eventType: SCRIPT_COMMAND,
    extensions: SCRIPT_CONTENT_TYPES,
    template: scriptTemplate,
    compile: buildScript,
    relay: {
      schemas: SCRIPT_RELAY_SCHEMAS,
      open: (state) => new ScriptRelay(
        new ScriptOutlineRelay(state, readOutline),
        new ScriptLintRelay(state, lint)
      )
    }
  });
}

export const ASSET_KINDS: AssetKindPackage = {
  descriptors: [SCRIPT_ASSET, TEXT_ASSET, SHADER_ASSET],
  optionsSchema: NO_OPTIONS_SCHEMA,
  handlers: () => [
    scriptAssetKind(),
    textAssetKind(),
    shaderAssetKind()
  ]
};
