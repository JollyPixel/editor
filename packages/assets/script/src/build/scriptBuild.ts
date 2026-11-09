// Import Third-party Dependencies
import type { AssetBuild } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { compileScript } from "#compiler";
import type { ScriptText } from "../asset/ScriptText.ts";
import type { ScriptImportPolicy } from "../imports/ScriptImportPolicy.ts";

// CONSTANTS
const kEncoder = new TextEncoder();

export function scriptBuild(
  imports: ScriptImportPolicy
): AssetBuild<ScriptText> {
  return {
    version: "1",
    type: "text/javascript",
    async build(state) {
      const code = await compileScript(state.text);
      await imports.check(code);

      return kEncoder.encode(code);
    }
  };
}
