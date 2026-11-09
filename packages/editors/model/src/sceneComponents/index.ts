// Import Third-party Dependencies
import { MODEL_ASSET } from "@jolly-pixel/asset.model/client";
import {
  shaderUniformRows,
  type SceneComponentKind,
  type SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import type {
  ModelAssets,
  ModelData
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { MODEL_DEFINITION } from "../runtime/index.ts";
import { modelForm } from "./modelForm.ts";
import {
  MODEL_FILE_DOCUMENT_KIND,
  SceneModels
} from "./SceneModels.ts";

// CONSTANTS
const kModel: SceneComponentKind<ModelData, ModelAssets> = {
  definition: MODEL_DEFINITION,
  label: "3D model",
  category: "3d",
  optionalAssets: ["shader"],
  form: (data, assets) => [
    ...modelForm(data, assets.resolve("model")),
    ...shaderUniformRows(assets.resolve("shader"))
  ]
};

export const SCENE_COMPONENTS: SceneComponentPackage = {
  components: [kModel],
  assets: [
    {
      descriptor: MODEL_ASSET,
      documentKinds: [MODEL_FILE_DOCUMENT_KIND],
      open: (session, updates) => new SceneModels(session, updates)
    }
  ]
};
