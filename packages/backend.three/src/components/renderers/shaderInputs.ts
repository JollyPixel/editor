// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  shaderTextureSlot,
  shaderUniformFromJSON,
  type Shader,
  type ShaderUniformValue,
  type ShaderUniformValues
} from "../../assets/Shader.ts";
import { TEXTURE_ASSET } from "../../assets/loaders/TextureAssetLoader.ts";

export type ShaderAssets = {
  shader: Shader;
};

export interface ShaderInputs {
  shader: Shader | null;
  uniforms: ShaderUniformValues;
}

export function parseUniformData(
  data: Readonly<Systems.JSONObject>
): Systems.JSONObject {
  const { uniforms } = data;

  return Systems.isJSONObject(uniforms) ? { ...uniforms } : {};
}

export function readShaderUniforms(
  shader: Shader,
  data: Readonly<Systems.JSONObject>
): ShaderUniformValues {
  const values: Record<string, ShaderUniformValue> = {};
  for (const [name, fallback] of Object.entries(shader.uniforms)) {
    if (!(fallback instanceof THREE.Texture)) {
      values[name] = shaderUniformFromJSON(fallback, data[name]);
    }
  }

  return values;
}

export function resolveShaderInputs(
  assets: Systems.ComponentAssets<ShaderAssets>,
  data: Readonly<Systems.JSONObject>
): ShaderInputs {
  const shader = assets.resolve("shader");
  if (shader === null) {
    return {
      shader,
      uniforms: {}
    };
  }

  const values: Record<string, ShaderUniformValue> = {
    ...readShaderUniforms(shader, data)
  };
  for (const [name, fallback] of Object.entries(shader.uniforms)) {
    const texture = fallback instanceof THREE.Texture ?
      assets.resolveSlot(shaderTextureSlot(name), TEXTURE_ASSET) :
      null;
    if (texture !== null) {
      values[name] = texture;
    }
  }

  return {
    shader,
    uniforms: values
  };
}
