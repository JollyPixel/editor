// Import Third-party Dependencies
import type {
  JSONObject,
  JSONValue
} from "@jolly-pixel/asset.scene/client";
import {
  inferScenePropertyType,
  Systems,
  type ScenePropertyType
} from "@jolly-pixel/engine";

export type ScriptListType = Extract<ScenePropertyType, `${string}[]`>;

export interface ScriptProperty {
  key: string;
  type: ScenePropertyType;
  value: JSONValue;
}

// CONSTANTS
const kDefaultColor = "#ffffff";
const kListSeparator = ",";

export function scriptProperties(
  properties: Readonly<JSONObject>
): ScriptProperty[] {
  return Object.entries(properties).map(([key, value]) => {
    return {
      key,
      type: inferScenePropertyType(value) ?? "string",
      value
    };
  });
}

export function convertProperty(
  value: JSONValue,
  type: ScenePropertyType
): JSONValue {
  const numbers = Array.isArray(value) ?
    value.filter((item) => typeof item === "number") :
    [typeof value === "number" ? value : 0];
  const first = numbers[0] ?? 0;

  switch (type) {
    case "number":
      return typeof value === "boolean" ? Number(value) : first;
    case "string":
      return Array.isArray(value) ? value.join(", ") : String(value ?? "");
    case "boolean":
      return typeof value === "boolean" ? value : first !== 0;
    case "Color":
      return Systems.isHexColor(value) ? value : kDefaultColor;
    case "Vector2":
      return vector(numbers, 2);
    case "Vector3":
      return vector(numbers, 3);
    case "Vector4":
      return vector(numbers, 4);
    case "number[]":
      return Array.isArray(value) || typeof value === "number" ? numbers : [];
    case "string[]":
      return Array.isArray(value) ?
        value.map((item) => String(item)) :
        parseList(String(value ?? ""), type);
    case "boolean[]":
      return Array.isArray(value) ?
        value.map((item) => item === true) :
        [typeof value === "boolean" ? value : first !== 0];
  }
}

export function listText(
  value: JSONValue
): string {
  return Array.isArray(value) ? value.join(`${kListSeparator} `) : "";
}

export function parseList(
  text: string,
  type: ScriptListType
): JSONValue[] {
  const items = text
    .split(kListSeparator)
    .map((item) => item.trim())
    .filter((item) => item !== "");

  switch (type) {
    case "number[]":
      return items.map(Number).filter(Number.isFinite);
    case "string[]":
      return items;
    case "boolean[]":
      return items.map((item) => item === "true");
  }
}

export function addProperty(
  properties: Readonly<JSONObject>,
  key: string,
  value: JSONValue
): JSONObject {
  const trimmed = key.trim();
  if (trimmed === "" || Object.hasOwn(properties, trimmed)) {
    return { ...properties };
  }

  return {
    ...properties,
    [trimmed]: value
  };
}

export function renameProperty(
  properties: Readonly<JSONObject>,
  from: string,
  to: string
): JSONObject {
  const trimmed = to.trim();
  if (trimmed === "") {
    return removeProperty(properties, from);
  }
  if (from === trimmed || Object.hasOwn(properties, trimmed)) {
    return { ...properties };
  }

  return Object.fromEntries(
    Object.entries(properties).map(
      ([key, value]) => [key === from ? trimmed : key, value]
    )
  );
}

export function removeProperty(
  properties: Readonly<JSONObject>,
  key: string
): JSONObject {
  const { [key]: _removed, ...rest } = properties;

  return rest;
}

function vector(
  numbers: readonly number[],
  length: number
): number[] {
  return Array.from(
    { length },
    (_, index) => numbers[index] ?? 0
  );
}
