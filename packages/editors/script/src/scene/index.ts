// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import {
  SCRIPT_ASSET,
  SHADER_ASSET,
  SCRIPT_KIND
} from "@jolly-pixel/asset.script/client";
import type {
  SceneComponentKind,
  SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import {
  ScriptDefinition,
  type ScriptData
} from "@jolly-pixel/engine";
import type { ScriptOutline } from "@jolly-pixel/scripting";

// Import Internal Dependencies
import {
  SCRIPT_DOCUMENT_KIND,
  SceneScripts
} from "./SceneScripts.ts";
import {
  SHADER_DOCUMENT_KIND,
  SceneShaders
} from "./SceneShaders.ts";
import { scriptForm } from "./scriptForm.ts";

type ScriptAssets = {
  script: ScriptOutline;
};

// CONSTANTS
export const SCRIPT_OUTLINE_ASSET = new AssetType<ScriptOutline>(SCRIPT_KIND);

const kRuntimeScript = new ScriptDefinition();

const kScript: SceneComponentKind<ScriptData, ScriptAssets> = {
  definition: {
    type: kRuntimeScript.type,
    assets: {
      script: SCRIPT_OUTLINE_ASSET
    },
    parse: (data) => kRuntimeScript.parse(data),
    create: () => null
  },
  label: "Script",
  category: "logic",
  form: (data, assets) => scriptForm(data, assets.resolve("script")),
  describe: (_data, assets) => {
    return { label: assets.script ?? "Script" };
  }
};

export const SCENE_COMPONENTS: SceneComponentPackage = {
  components: [kScript],
  assets: [
    {
      descriptor: SCRIPT_ASSET,
      documentKinds: [SCRIPT_DOCUMENT_KIND],
      open: (session, updates) => new SceneScripts(session, updates)
    },
    {
      descriptor: SHADER_ASSET,
      documentKinds: [SHADER_DOCUMENT_KIND],
      open: (session, updates) => new SceneShaders(session, updates)
    }
  ]
};
