// Import Third-party Dependencies
import type {
  JSONObject,
  JSONValue
} from "@jolly-pixel/asset.scene/client";

export type ScriptPropertyType =
  | "number"
  | "string"
  | "boolean"
  | "vector2"
  | "vector3"
  | "vector4"
  | "color";

export interface ScriptProperty {
  key: string;
  type: ScriptPropertyType;
  value: JSONValue;
}

// CONSTANTS
export const SCRIPT_PROPERTY_TYPES: readonly ScriptPropertyType[] = [
  "number",
  "string",
  "boolean",
  "vector2",
  "vector3",
  "vector4",
  "color"
];
const kVectorLengths: Readonly<Record<string, ScriptPropertyType>> = {
  2: "vector2",
  3: "vector3",
  4: "vector4"
};
const kHexColor = /^#[0-9a-f]{6}$/i;
const kDefaultColor = "#ffffff";

export function scriptProperties(
  properties: Readonly<JSONObject>
): ScriptProperty[] {
  return Object.entries(properties).map(([key, value]) => {
    return {
      key,
      type: propertyType(value),
      value
    };
  });
}

function propertyType(
  value: JSONValue
): ScriptPropertyType {
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "string") {
    return kHexColor.test(value) ? "color" : "string";
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return kVectorLengths[value.length] ?? "string";
  }

  return "string";
}

export function convertProperty(
  value: JSONValue,
  type: ScriptPropertyType
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
    case "color":
      return typeof value === "string" && kHexColor.test(value) ?
        value :
        kDefaultColor;
    case "vector2":
      return vector(numbers, 2);
    case "vector3":
      return vector(numbers, 3);
    case "vector4":
      return vector(numbers, 4);
  }
}

export function freePropertyKey(
  properties: Readonly<JSONObject>,
  base = "property"
): string {
  let key = base;
  for (let suffix = 2; Object.hasOwn(properties, key); suffix++) {
    key = `${base}${suffix}`;
  }

  return key;
}

export function renameProperty(
  properties: Readonly<JSONObject>,
  from: string,
  to: string
): JSONObject {
  if (from === to || Object.hasOwn(properties, to)) {
    return { ...properties };
  }

  return Object.fromEntries(
    Object.entries(properties).map(
      ([key, value]) => [key === from ? to : key, value]
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
