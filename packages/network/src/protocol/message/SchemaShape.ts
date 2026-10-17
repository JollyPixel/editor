// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import type { Schema } from "../schema.ts";

export type ConstValue = string | number | boolean;

export function isConstValue(
  value: unknown
): value is ConstValue {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean";
}

export const SchemaShape = {
  options(
    schema: Schema
  ): readonly Schema[] | null {
    return schema instanceof z.core.$ZodUnion ?
      schema._zod.def.options :
      null;
  },

  properties(
    schema: Schema
  ): Readonly<Record<string, Schema>> | null {
    return schema instanceof z.core.$ZodObject ?
      schema._zod.def.shape :
      null;
  },

  constOf(
    schema: Schema
  ): ConstValue | undefined {
    if (!(schema instanceof z.core.$ZodLiteral)) {
      return undefined;
    }

    const { values } = schema._zod.def;

    return values.length === 1 && isConstValue(values[0]) ?
      values[0] :
      undefined;
  },

  isOptional(
    schema: Schema
  ): boolean {
    return schema._zod.optin === "optional";
  },

  unwrapOptional(
    schema: Schema
  ): Schema {
    return schema instanceof z.core.$ZodOptional ?
      schema._zod.def.innerType :
      schema;
  }
};
