// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { JSONValue } from "../../systems/scene/file/SceneFile.ts";
import { isHexColor } from "../../systems/scene/file/ComponentData.ts";

// CONSTANTS
const kScenePropertyKinds = {
  number: {
    parse: (value) => (isNumber(value) ? value : undefined),
    createDefault: () => 0
  },
  string: {
    parse: (value) => (isString(value) ? value : undefined),
    createDefault: () => ""
  },
  boolean: {
    parse: (value) => (isBoolean(value) ? value : undefined),
    createDefault: () => false
  },
  Vector2: {
    parse: (value) => parseNumbers(value, 2, (x, y) => new THREE.Vector2(x, y)),
    createDefault: () => new THREE.Vector2()
  },
  Vector3: {
    parse: (value) => parseNumbers(value, 3, (x, y, z) => new THREE.Vector3(x, y, z)),
    createDefault: () => new THREE.Vector3()
  },
  Vector4: {
    parse: (value) => parseNumbers(value, 4, (x, y, z, w) => new THREE.Vector4(x, y, z, w)),
    createDefault: () => new THREE.Vector4()
  },
  Color: {
    parse: (value) => (isHexColor(value) ? new THREE.Color(value) : undefined),
    createDefault: () => new THREE.Color(0, 0, 0)
  },
  "number[]": {
    parse: (value) => parseArray(value, isNumber),
    createDefault: () => []
  },
  "string[]": {
    parse: (value) => parseArray(value, isString),
    createDefault: () => []
  },
  "boolean[]": {
    parse: (value) => parseArray(value, isBoolean),
    createDefault: () => []
  }
} satisfies Record<string, ScenePropertyKind>;
const kVectorTypes: Readonly<Record<number, ScenePropertyType>> = {
  2: "Vector2",
  3: "Vector3",
  4: "Vector4"
};

interface ScenePropertyKind {
  parse(value: JSONValue): unknown;
  createDefault(): unknown;
}

export type ScenePropertyType = keyof typeof kScenePropertyKinds;

export const SCENE_PROPERTY_TYPES = Object.keys(
  kScenePropertyKinds
) as readonly ScenePropertyType[];

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
  return kScenePropertyKinds[type].parse(value);
}

export function createScenePropertyDefault(
  type: ScenePropertyType
): unknown {
  return kScenePropertyKinds[type].createDefault();
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
