// Import Internal Dependencies
import { Actor } from "../../actor/Actor.ts";
import type { JSONValue } from "../../systems/scene/file/SceneFile.ts";
import { isHexColor } from "../../systems/scene/file/definitions/ComponentData.ts";

// CONSTANTS
const kPropertySlotPrefix = "property:";
const kBlackColor = "#000000";
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
  Vector2: vectorKind(["x", "y"]),
  Vector3: vectorKind(["x", "y", "z"]),
  Vector4: vectorKind(["x", "y", "z", "w"]),
  Color: {
    parse: (value) => (isHexColor(value) ? value : undefined),
    createDefault: () => kBlackColor,
    serialize: (value) => (isHexColor(value) ? value : undefined)
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
const kAssetPropertyKind: ScenePropertyKind = {
  parse: () => undefined,
  createDefault: () => null,
  serialize: () => undefined
};
const kBehaviorPropertyKinds: Record<BehaviorPropertyType, ScenePropertyKind> = {
  ...kScenePropertyKinds,
  Sound: kAssetPropertyKind,
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

type VectorComponent = "x" | "y" | "z" | "w";

interface ScenePropertyKind {
  parse(value: JSONValue): unknown;
  createDefault(): unknown;
  serialize(value: unknown): JSONValue | undefined;
  bind?(value: unknown, scope: ScenePropertyScope): unknown;
}

export type ScenePropertyType = keyof typeof kScenePropertyKinds;
export type AssetPropertyType = typeof ASSET_PROPERTY_TYPES[number];
export type BehaviorPropertyType = ScenePropertyType | AssetPropertyType | "Actor";

export const ASSET_PROPERTY_TYPES = ["Sound"] as const;

export function scriptPropertySlot(
  property: string
): string {
  return `${kPropertySlotPrefix}${property}`;
}

export function isAssetPropertyType(
  type: BehaviorPropertyType
): type is AssetPropertyType {
  return ASSET_PROPERTY_TYPES.some((known) => known === type);
}

export function isScriptPropertySlot(
  slot: string
): boolean {
  return slot.startsWith(kPropertySlotPrefix);
}

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

function vectorKind(
  components: readonly VectorComponent[]
): ScenePropertyKind {
  return {
    parse: (value) => (
      Array.isArray(value) &&
      value.length === components.length &&
      value.every(isNumber) ?
        createVector(components, value) :
        undefined
    ),
    createDefault: () => createVector(components, components.map(() => 0)),
    serialize: (value) => {
      if (typeof value !== "object" || value === null) {
        return undefined;
      }
      const values = components.map((component) => Reflect.get(value, component));

      return values.every(isNumber) ? values : undefined;
    }
  };
}

function createVector(
  components: readonly VectorComponent[],
  values: readonly number[]
): Record<string, number> {
  return Object.fromEntries(
    components.map((component, index) => [component, values[index]])
  );
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
