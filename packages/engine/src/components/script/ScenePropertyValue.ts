// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { ScenePropertyType } from "./BehaviorDecorators.ts";
import type { JSONValue } from "../../systems/scene/file/SceneFile.ts";
import { isHexColor } from "../../systems/scene/file/ComponentData.ts";

// CONSTANTS
export const SCENE_PROPERTY_TYPES: readonly ScenePropertyType[] = [
  "number",
  "string",
  "boolean",
  "Vector2",
  "Vector3",
  "Vector4",
  "Color",
  "number[]",
  "string[]",
  "boolean[]"
];
const kVectorTypes: Readonly<Record<number, ScenePropertyType>> = {
  2: "Vector2",
  3: "Vector3",
  4: "Vector4"
};

export function inferScenePropertyType(
  value: JSONValue
): ScenePropertyType | null {
  if (isNumber(value)) {
    return "number";
  }
  if (isBoolean(value)) {
    return "boolean";
  }
  if (isString(value)) {
    return isHexColor(value) ? "Color" : "string";
  }
  if (!Array.isArray(value)) {
    return null;
  }
  if (value.every(isNumber)) {
    return kVectorTypes[value.length] ?? "number[]";
  }
  if (value.every(isString)) {
    return "string[]";
  }

  return value.every(isBoolean) ? "boolean[]" : null;
}

export function parseScenePropertyValue(
  type: ScenePropertyType,
  value: JSONValue
): unknown {
  switch (type) {
    case "string":
      return isString(value) ? value : undefined;
    case "number":
      return isNumber(value) ? value : undefined;
    case "boolean":
      return isBoolean(value) ? value : undefined;
    case "string[]":
      return parseArray(value, isString);
    case "number[]":
      return parseArray(value, isNumber);
    case "boolean[]":
      return parseArray(value, isBoolean);
    case "Vector2":
      return parseNumbers(value, 2, (x, y) => new THREE.Vector2(x, y));
    case "Vector3":
      return parseNumbers(value, 3, (x, y, z) => new THREE.Vector3(x, y, z));
    case "Vector4":
      return parseNumbers(value, 4, (x, y, z, w) => new THREE.Vector4(x, y, z, w));
    case "Color":
      return isHexColor(value) ?
        new THREE.Color(value) :
        undefined;
  }
}

function parseArray<T extends JSONValue>(
  value: JSONValue,
  isItem: (item: JSONValue) => item is T
): T[] | undefined {
  return Array.isArray(value) && value.every(isItem) ?
    [...value] :
    undefined;
}

function parseNumbers<T>(
  value: JSONValue,
  length: number,
  create: (...components: number[]) => T
): T | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== length ||
    !value.every(isNumber)
  ) {
    return undefined;
  }

  return create(...value);
}

function isString(
  value: JSONValue
): value is string {
  return typeof value === "string";
}

function isNumber(
  value: JSONValue
): value is number {
  return typeof value === "number";
}

function isBoolean(
  value: JSONValue
): value is boolean {
  return typeof value === "boolean";
}
