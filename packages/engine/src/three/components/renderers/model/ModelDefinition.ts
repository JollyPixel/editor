// Import Internal Dependencies
import type { Actor } from "../../../../core/actor/Actor.ts";
import {
  ModelAssetType,
  type Model
} from "../../../assets/model.ts";
import {
  ShaderAssetType,
  type Shader
} from "../../../assets/shader.ts";
import { ComponentData } from "../../../../core/systems/scene/file/definitions/ComponentData.ts";
import type {
  ComponentContext,
  ComponentDefinition
} from "../../../../core/systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../../../core/systems/scene/file/SceneFile.ts";
import {
  parseUniformData,
  resolveShaderInputs
} from "../shaderInputs.ts";
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

export interface ModelData extends ModelSettings {
  /**
   * Values of the shader's uniforms, keyed by uniform name.
   */
  uniforms: JSONObject;
}

export type ModelAssets = {
  model: Model;
  shader: Shader;
};

// CONSTANTS
export const MODEL_DEFAULTS = {
  animation: "",
  castShadow: false,
  receiveShadow: false
} as const satisfies ModelSettings;

export class ModelDefinition implements ComponentDefinition<
  ModelData,
  ModelRenderer,
  ModelAssets
> {
  readonly type = "Model";
  readonly assets = {
    model: ModelAssetType,
    shader: ShaderAssetType
  };

  parse(
    data: Readonly<JSONObject>
  ): ModelData {
    const fields = new ComponentData(data);

    return {
      animation: fields.string("animation", MODEL_DEFAULTS.animation),
      castShadow: fields.boolean("castShadow", MODEL_DEFAULTS.castShadow),
      receiveShadow: fields.boolean(
        "receiveShadow",
        MODEL_DEFAULTS.receiveShadow
      ),
      uniforms: parseUniformData(data)
    };
  }

  create(
    actor: Actor<any>,
    data: ModelData,
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
      ...resolveShaderInputs(context.assets, data.uniforms),
      animations: plays ? { default: data.animation } : {}
    });
  }
}
