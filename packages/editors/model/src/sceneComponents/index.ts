// Import Third-party Dependencies
import { MODEL_ASSET } from "@jolly-pixel/asset.model/client";
import type {
  SceneComponentKind,
  SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import {
  ModelDefinition,
  type ModelAssets,
  type ModelSettings
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { modelForm } from "./modelForm.ts";
import {
  MODEL_FILE_DOCUMENT_KIND,
  SceneModels
} from "./SceneModels.ts";

// CONSTANTS
const kModel: SceneComponentKind<ModelSettings, ModelAssets> = {
  definition: new ModelDefinition(),
  label: "3D model",
  form: (data, assets) => modelForm(data, assets.resolve("model"))
};

export const SCENE_COMPONENTS: SceneComponentPackage = {
  components: [kModel],
  presets: [
    {
      category: "3d",
      presets: [
        {
          id: "model",
          label: "3D model",
          components: [
            {
              type: "Model",
              data: {}
            }
          ]
        }
      ]
    }
  ],
  assets: [
    {
      descriptor: MODEL_ASSET,
      documentKinds: [MODEL_FILE_DOCUMENT_KIND],
      open: (session, updates) => new SceneModels(session, updates)
    }
  ]
};
