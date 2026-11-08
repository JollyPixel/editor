// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  shaderTextureSlot,
  shaderUniformFromJSON,
  type Shader,
  type ShaderUniformValue,
  type ShaderUniformValues
} from "../../assets/shader.ts";
import { TEXTURE_ASSET } from "../../assets/texture.ts";
import { isJSONObject } from "../../systems/scene/file/definitions/ComponentData.ts";
import type { ComponentAssets } from "../../systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../systems/scene/file/SceneFile.ts";

export type ShaderAssets = {
  shader: Shader;
};

export interface ShaderInputs {
  shader: Shader | null;
  uniforms: ShaderUniformValues;
}

export function parseUniformData(
  data: Readonly<JSONObject>
): JSONObject {
  const { uniforms } = data;

  return isJSONObject(uniforms) ? { ...uniforms } : {};
}

export function readShaderUniforms(
  shader: Shader,
  data: Readonly<JSONObject>
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
  assets: ComponentAssets<ShaderAssets>,
  data: Readonly<JSONObject>
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
