// Import Third-party Dependencies
import type { AssetKindHandler } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { scriptBuild } from "../build/scriptBuild.ts";
import { SHADER_IMPORTS } from "../imports/importPolicies.ts";
import {
  SHADER_COMMAND,
  SHADER_CONTENT_TYPES,
  SHADER_KIND,
  SHADER_TEMPLATE
} from "./shader.ts";
import type { ScriptText } from "./ScriptText.ts";
import {
  textKindHandler,
  type TextAssetKindOptions
} from "./textAssetKind.ts";
import type { ScriptNetworkCommand } from "../network/types.ts";

export function shaderAssetKind(
  options: TextAssetKindOptions = {}
): AssetKindHandler<ScriptText, ScriptNetworkCommand> {
  return textKindHandler({
    kind: SHADER_KIND,
    eventType: SHADER_COMMAND,
    extensions: SHADER_CONTENT_TYPES,
    template: SHADER_TEMPLATE,
    snapshot: options.snapshot,
    build: scriptBuild(SHADER_IMPORTS)
  });
}
