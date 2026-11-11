// Import Third-party Dependencies
import type { AssetKindHandler } from "@jolly-pixel/asset-server";
import { buildShader } from "@jolly-pixel/scripting";

// Import Internal Dependencies
import {
  SHADER_COMMAND,
  SHADER_CONTENT_TYPES,
  SHADER_KIND,
  SHADER_TEMPLATE
} from "./shader.ts";
import {
  textKindHandler,
  type TextAssetKindOptions
} from "./textAssetKind.ts";
import type { ScriptText } from "../model/ScriptText.ts";
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
    compile: buildShader
  });
}
