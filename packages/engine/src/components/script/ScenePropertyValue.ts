// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Actor } from "../../actor/Actor.ts";
import type { JSONValue } from "../../systems/scene/file/SceneFile.ts";
import { isHexColor } from "../../systems/scene/file/definitions/ComponentData.ts";

// CONSTANTS
const kScenePropertyKinds = {
  number: {
    parse: (value) => (isNumber(value) ? value : undefined),
    createDefault: () => 0,
    serialize: (value) => (isNumber(value) ? value : undefined)
  },
  string: {
    parse: (value) => (isString(value) ? value : undefined),
    createDefault: () => "",
    serialize: (value) => (isString(value) ? value : undefined)
  },
  boolean: {
    parse: (value) => (isBoolean(value) ? value : undefined),
    createDefault: () => false,
    serialize: (value) => (isBoolean(value) ? value : undefined)
  },
  Vector2: {
    parse: (value) => parseNumbers(value, 2, (x, y) => new THREE.Vector2(x, y)),
    createDefault: () => new THREE.Vector2(),
    serialize: (value) => (value instanceof THREE.Vector2 ? value.toArray() : undefined)
  },
  Vector3: {
    parse: (value) => parseNumbers(value, 3, (x, y, z) => new THREE.Vector3(x, y, z)),
    createDefault: () => new THREE.Vector3(),
    serialize: (value) => (value instanceof THREE.Vector3 ? value.toArray() : undefined)
  },
  Vector4: {
    parse: (value) => parseNumbers(value, 4, (x, y, z, w) => new THREE.Vector4(x, y, z, w)),
    createDefault: () => new THREE.Vector4(),
    serialize: (value) => (value instanceof THREE.Vector4 ? value.toArray() : undefined)
  },
  Color: {
    parse: (value) => (isHexColor(value) ? new THREE.Color(value) : undefined),
    createDefault: () => new THREE.Color(0, 0, 0),
    serialize: (value) => (value instanceof THREE.Color ? `#${value.getHexString()}` : undefined)
  },
  "number[]": {
    parse: (value) => parseArray(value, isNumber),
    createDefault: () => [],
    serialize: (value) => parseArray(value, isNumber)
  },
  "string[]": {
    parse: (value) => parseArray(value, isString),
    createDefault: () => [],
    serialize: (value) => parseArray(value, isString)
  },
  "boolean[]": {
    parse: (value) => parseArray(value, isBoolean),
    createDefault: () => [],
    serialize: (value) => parseArray(value, isBoolean)
  }
} satisfies Record<string, ScenePropertyKind>;
const kBehaviorPropertyKinds: Record<BehaviorPropertyType, ScenePropertyKind> = {
  ...kScenePropertyKinds,
  Actor: {
    parse: (value) => (isString(value) || value === null ? value : undefined),
    createDefault: () => null,
    serialize: (value) => (
      value instanceof Actor && !value.pendingForDestruction ? value.persistentId : null
    ),
    bind: (value, scope) => (isString(value) ? scope.findActor(value) : value ?? null)
  }
};
const kVectorTypes: Readonly<Record<number, ScenePropertyType>> = {
  2: "Vector2",
  3: "Vector3",
  4: "Vector4"
};

export interface ScenePropertyScope {
  findActor(persistentId: string): Actor<any> | null;
}

interface ScenePropertyKind {
  parse(value: JSONValue): unknown;
  createDefault(): unknown;
  serialize(value: unknown): JSONValue | undefined;
  bind?(value: unknown, scope: ScenePropertyScope): unknown;
}

export type ScenePropertyType = keyof typeof kScenePropertyKinds;
export type BehaviorPropertyType = ScenePropertyType | "Actor";

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
  type: BehaviorPropertyType,
  value: JSONValue
): unknown {
  return kBehaviorPropertyKinds[type].parse(value);
}

export function bindScenePropertyValue(
  type: BehaviorPropertyType,
  value: unknown,
  scope: ScenePropertyScope
): unknown {
  const kind = kBehaviorPropertyKinds[type];

  return kind.bind ?
    kind.bind(value, scope) :
    value ?? kind.createDefault();
}

export function serializeScenePropertyValue(
  type: BehaviorPropertyType,
  value: unknown
): JSONValue | undefined {
  return kBehaviorPropertyKinds[type].serialize(value);
}

function parseArray<T extends JSONValue>(
  value: unknown,
  isItem: (item: unknown) => item is T
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
  value: unknown
): value is string {
  return typeof value === "string";
}

function isNumber(
  value: unknown
): value is number {
  return typeof value === "number";
}

function isBoolean(
  value: unknown
): value is boolean {
  return typeof value === "boolean";
}
