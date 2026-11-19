// Import Third-party Dependencies
import type { AssetKindHandler } from "@jolly-pixel/asset-server";
import {
  buildShader,
  lintScript
} from "@jolly-pixel/scripting";

// Import Internal Dependencies
import {
  SHADER_COMMAND,
  SHADER_CONTENT_TYPES,
  SHADER_KIND,
  SHADER_TEMPLATE
} from "./shader.ts";
import { textKindHandler } from "./textAssetKind.ts";
import type { ScriptText } from "../model/ScriptText.ts";
import {
  SHADER_RELAY_SCHEMAS,
  type ScriptLintRequest
} from "../network/ScriptCommand.schema.ts";
import { ScriptLintRelay } from "../network/ScriptLintRelay.ts";
import type { ScriptNetworkCommand } from "../network/types.ts";

export function shaderAssetKind(): AssetKindHandler<ScriptText, ScriptNetworkCommand, ScriptLintRequest> {
  return textKindHandler<ScriptLintRequest>({
    kind: SHADER_KIND,
    eventType: SHADER_COMMAND,
    extensions: SHADER_CONTENT_TYPES,
    template: () => SHADER_TEMPLATE,
    compile: buildShader,
    relay: {
      schemas: SHADER_RELAY_SCHEMAS,
      open: (state) => new ScriptLintRelay(state, lintScript)
    }
  });
}
