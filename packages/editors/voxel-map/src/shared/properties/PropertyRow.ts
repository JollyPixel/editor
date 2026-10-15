// Import Third-party Dependencies
import type { BlockProperties } from "@jolly-pixel/voxel.renderer";

export type PropertyValue = BlockProperties[string];
export type PropertyType = "string" | "number" | "boolean";

export interface PropertyRowPatch {
  key?: string;
  value?: PropertyValue;
}

export class PropertyRow {
  readonly key: string;
  readonly value: PropertyValue;

  constructor(
    key = "",
    value: PropertyValue = ""
  ) {
    this.key = key;
    this.value = value;

    Object.freeze(this);
  }

  get type(): PropertyType {
    if (typeof this.value === "number") {
      return "number";
    }

    return typeof this.value === "boolean" ? "boolean" : "string";
  }

  with(
    patch: PropertyRowPatch
  ): PropertyRow {
    return new PropertyRow(
      patch.key ?? this.key,
      patch.value ?? this.value
    );
  }

  retype(
    type: PropertyType
  ): PropertyRow {
    return new PropertyRow(this.key, this.#convertTo(type));
  }

  #convertTo(
    type: PropertyType
  ): PropertyValue {
    const { value } = this;

    switch (type) {
      case "string":
        return String(value);
      case "number": {
        if (typeof value === "boolean") {
          return value ? 1 : 0;
        }
        const number = Number(value);

        return Number.isFinite(number) ? number : 0;
      }
      case "boolean":
        return typeof value === "string" ?
          value.trim().toLowerCase() === "true" :
          Boolean(value);
      default: {
        const unhandled: never = type;
        throw new Error(`PropertyRow: unknown type '${String(unhandled)}'.`);
      }
    }
  }
}
