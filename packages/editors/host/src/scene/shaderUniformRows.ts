// Import Third-party Dependencies
import {
  TEXTURE_ASSET,
  describeShaderUniform,
  shaderTextureSlot,
  type Shader,
  type Systems
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  FormRows,
  type FormRow
} from "./FormRows.ts";

export interface ShaderUniformData {
  uniforms: Systems.JSONObject;
}

// CONSTANTS
const kStep = 0.01;
const kRows = new FormRows<ShaderUniformData>();
const kVectorSizes = {
  vector2: 2,
  vector3: 3,
  vector4: 4
} as const;

export function shaderUniformRows(
  shader: Shader | null
): FormRow<ShaderUniformData>[] {
  return Object.entries(shader?.uniforms ?? {}).map(([name, value]) => {
    const uniform = describeShaderUniform(value);
    if (uniform.kind === "texture") {
      return kRows.asset(shaderTextureSlot(name), name, TEXTURE_ASSET);
    }

    const path = ["uniforms", name] as const;
    const fallback = uniform.json;
    switch (uniform.kind) {
      case "number":
        return {
          ...kRows.number(path, name, { step: kStep }),
          fallback
        };
      case "color":
        return {
          ...kRows.color(path, name),
          fallback
        };
      default:
        return {
          ...kRows.vector(path, name, { step: kStep }),
          size: kVectorSizes[uniform.kind],
          fallback
        };
    }
  });
}
