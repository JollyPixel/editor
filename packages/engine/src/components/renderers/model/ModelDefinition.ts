// Import Internal Dependencies
import type { Actor } from "../../../actor/Actor.ts";
import {
  ModelAssetType,
  type Model
} from "../../../assets/model.ts";
import { ComponentData } from "../../../systems/scene/file/definitions/ComponentData.ts";
import type {
  ComponentContext,
  ComponentDefinition
} from "../../../systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../../systems/scene/file/SceneFile.ts";
import { ModelRenderer } from "./ModelRenderer.ts";

export interface ModelSettings {
  /**
   * Clip played in play mode; `""` plays none.
   * @default ""
   */
  animation: string;
  /**
   * @default false
   */
  castShadow: boolean;
  /**
   * @default false
   */
  receiveShadow: boolean;
}

export type ModelAssets = {
  model: Model;
};

// CONSTANTS
export const MODEL_DEFAULTS = {
  animation: "",
  castShadow: false,
  receiveShadow: false
} as const satisfies ModelSettings;

export class ModelDefinition implements ComponentDefinition<
  ModelSettings,
  ModelRenderer,
  ModelAssets
> {
  readonly type = "Model";
  readonly assets = {
    model: ModelAssetType
  };

  parse(
    data: Readonly<JSONObject>
  ): ModelSettings {
    const fields = new ComponentData(data);

    return {
      animation: fields.string("animation", MODEL_DEFAULTS.animation),
      castShadow: fields.boolean("castShadow", MODEL_DEFAULTS.castShadow),
      receiveShadow: fields.boolean(
        "receiveShadow",
        MODEL_DEFAULTS.receiveShadow
      )
    };
  }

  create(
    actor: Actor<any>,
    data: ModelSettings,
    context: ComponentContext<ModelAssets>
  ): ModelRenderer | null {
    const model = context.assets.resolve("model");
    if (model === null) {
      return null;
    }

    const plays = context.mode === "play" &&
      model.animations.some((clip) => clip.name === data.animation);

    return actor.addComponentAndGet(ModelRenderer, {
      model,
      castShadow: data.castShadow,
      receiveShadow: data.receiveShadow,
      animations: plays ? { default: data.animation } : {}
    });
  }
}
