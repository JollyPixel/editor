// Import Internal Dependencies
import type {
  ColorJSON,
  JSONObject,
  JSONValue
} from "./SceneFile.ts";

// CONSTANTS
const kHexColor = /^#[0-9a-f]{6}$/i;

export class ComponentData {
  #data: Readonly<JSONObject>;

  constructor(
    data: Readonly<JSONObject>
  ) {
    this.#data = data;
  }

  number(
    key: string,
    fallback: number
  ): number {
    const value = this.#data[key];

    return typeof value === "number" && Number.isFinite(value) ?
      value :
      fallback;
  }

  string(
    key: string,
    fallback: string
  ): string {
    const value = this.#data[key];

    return typeof value === "string" ? value : fallback;
  }

  boolean(
    key: string,
    fallback: boolean
  ): boolean {
    const value = this.#data[key];

    return typeof value === "boolean" ? value : fallback;
  }

  color(
    key: string,
    fallback: ColorJSON
  ): ColorJSON {
    const value = this.#data[key];

    return isHexColor(value) ? value : fallback;
  }

  choice<T extends string>(
    key: string,
    values: Readonly<Record<T, unknown>>,
    fallback: NoInfer<T>
  ): T {
    const value = this.#data[key];

    return isChoice(values, value) ? value : fallback;
  }

  object(
    key: string
  ): ComponentData | null {
    const value = this.#data[key];

    return isJSONObject(value) ? new ComponentData(value) : null;
  }
}

function isChoice<T extends string>(
  record: Readonly<Record<T, unknown>>,
  value: JSONValue | undefined
): value is T {
  return typeof value === "string" && Object.hasOwn(record, value);
}

export function isJSONObject(
  value: JSONValue | undefined
): value is JSONObject {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value);
}

export function isHexColor(
  value: JSONValue | undefined
): value is ColorJSON {
  return typeof value === "string" && kHexColor.test(value);
}
