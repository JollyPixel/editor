// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import {
  SCRIPT_ASSET,
  SCRIPT_KIND,
  type ScriptOutline
} from "@jolly-pixel/asset.script/client";
import type {
  SceneComponentKind,
  SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import {
  ScriptDefinition,
  type ScriptData
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  SCRIPT_DOCUMENT_KIND,
  SceneScripts
} from "./SceneScripts.ts";
import { scriptForm } from "./scriptForm.ts";

type ScriptAssets = {
  script: ScriptOutline;
};

// CONSTANTS
export const SCRIPT_OUTLINE_ASSET = new AssetType<ScriptOutline>(SCRIPT_KIND);

class ScriptAssetDefinition extends ScriptDefinition {
  readonly assets = {
    script: SCRIPT_OUTLINE_ASSET
  };

  constructor() {
    super({});
  }
}

const kScript: SceneComponentKind<ScriptData, ScriptAssets> = {
  definition: new ScriptAssetDefinition(),
  label: "Script",
  category: "logic",
  form: (data, assets) => scriptForm(data, assets.resolve("script"))
};

export const SCENE_COMPONENTS: SceneComponentPackage = {
  components: [kScript],
  assets: [
    {
      descriptor: SCRIPT_ASSET,
      documentKinds: [SCRIPT_DOCUMENT_KIND],
      open: (session, updates) => new SceneScripts(session, updates)
    }
  ]
};
