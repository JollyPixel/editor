// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  isHexColor,
  isJSONObject
} from "../systems/scene/file/definitions/ComponentData.ts";
import type { JSONValue } from "../systems/scene/file/SceneFile.ts";

export type ShaderUniformValue =
  | number
  | THREE.Color
  | THREE.Vector2
  | THREE.Vector3
  | THREE.Vector4
  | THREE.Texture;

export type ShaderDataUniformValue = Exclude<ShaderUniformValue, THREE.Texture>;

export type ShaderUniformValues = Readonly<Record<string, ShaderUniformValue>>;

export type ShaderUniformDescription =
  | { kind: "texture"; }
  | { kind: "number" | "color" | "vector2" | "vector3" | "vector4"; json: JSONValue; };

export type ShaderUniformKind = ShaderUniformDescription["kind"];

export interface ShadedMaterial {
  readonly material: THREE.Material;

  assign(
    values: ShaderUniformValues
  ): void;
}

export interface Shader {
  /**
   * Declared uniforms with their default values.
   */
  readonly uniforms: ShaderUniformValues;

  createMaterial(
    values?: ShaderUniformValues
  ): ShadedMaterial;
}

// CONSTANTS
const kTextureSlotPrefix = "texture:";
const kAxes = ["x", "y", "z", "w"] as const;

export const ShaderAssetType = new AssetType<Shader>("shader");

export function shaderTextureSlot(
  uniform: string
): string {
  return `${kTextureSlotPrefix}${uniform}`;
}

export function isShaderUniformValue(
  value: unknown
): value is ShaderUniformValue {
  return typeof value === "number" ||
    value instanceof THREE.Color ||
    value instanceof THREE.Vector2 ||
    value instanceof THREE.Vector3 ||
    value instanceof THREE.Vector4 ||
    value instanceof THREE.Texture;
}

export function describeShaderUniform(
  value: ShaderUniformValue
): ShaderUniformDescription {
  if (value instanceof THREE.Texture) {
    return { kind: "texture" };
  }

  return {
    kind: dataUniformKind(value),
    json: uniformToJSON(value)
  };
}

function dataUniformKind(
  value: ShaderDataUniformValue
): Exclude<ShaderUniformKind, "texture"> {
  if (typeof value === "number") {
    return "number";
  }
  if (value instanceof THREE.Color) {
    return "color";
  }
  if (value instanceof THREE.Vector2) {
    return "vector2";
  }

  return value instanceof THREE.Vector3 ? "vector3" : "vector4";
}

function uniformToJSON(
  value: ShaderDataUniformValue
): JSONValue {
  if (typeof value === "number") {
    return value;
  }
  if (value instanceof THREE.Color) {
    return `#${value.getHexString()}`;
  }

  const components = value.toArray();

  return Object.fromEntries(
    kAxes.slice(0, components.length).map((axis, index) => [axis, components[index]])
  );
}

export function shaderUniformFromJSON(
  fallback: ShaderDataUniformValue,
  value: JSONValue | undefined
): ShaderDataUniformValue {
  if (typeof fallback === "number") {
    return typeof value === "number" ? value : fallback;
  }
  if (fallback instanceof THREE.Color) {
    return isHexColor(value) ? new THREE.Color(value) : fallback;
  }

  const vector = fallback.clone();
  if (isJSONObject(value)) {
    for (const [index, axis] of kAxes.slice(0, vector.toArray().length).entries()) {
      const component = value[axis];
      if (typeof component === "number") {
        vector.setComponent(index, component);
      }
    }
  }

  return vector;
}
