// Import Third-party Dependencies
import { type Actor, Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { ModelAssetType } from "../../../assets/loaders/ModelAssetLoader.ts";
import type { Model } from "../../../assets/loaders/parseModel.ts";
import {
  ShaderAssetType,
  type Shader
} from "../../../assets/Shader.ts";
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
  uniforms: Systems.JSONObject;
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

export class ModelDefinition implements Systems.ComponentDefinition<
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
    data: Readonly<Systems.JSONObject>
  ): ModelData {
    const fields = new Systems.ComponentData(data);

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
    context: Systems.ComponentContext<ModelAssets>
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
