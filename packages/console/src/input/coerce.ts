// Import Internal Dependencies
import type {
  ArgDef,
  ConsoleValue
} from "../registry/types.ts";
import { InvalidValueError } from "./errors/InvalidValueError.ts";

// CONSTANTS
const kTruthy = /^(?:y|yes|true|1|on)$/i;
const kFalsy = /^(?:n|no|false|0|off)$/i;

export function coerceNumber(
  literal: string
): number {
  const value = literal.trim() === "" ? Number.NaN : Number(literal);
  if (!Number.isFinite(value)) {
    throw new InvalidValueError(literal, "a number");
  }

  return value;
}

export function coerceBoolean(
  literal: string
): boolean {
  const trimmed = literal.trim();
  if (kTruthy.test(trimmed)) {
    return true;
  }
  if (kFalsy.test(trimmed)) {
    return false;
  }

  throw new InvalidValueError(
    literal,
    "a boolean (true, false, yes, no, on, off, 1, 0)"
  );
}

export function coerceEnum<TValue extends string>(
  literal: string,
  enumValues: readonly TValue[]
): TValue {
  const lowered = literal.toLowerCase();
  const value = enumValues
    .find((candidate) => candidate.toLowerCase() === lowered);
  if (value === undefined) {
    throw new InvalidValueError(literal, `one of ${enumValues.join(", ")}`);
  }

  return value;
}

export function coerce(
  literal: string,
  arg: ArgDef
): ConsoleValue {
  switch (arg.type) {
    case "number":
      return coerceNumber(literal);
    case "boolean":
      return coerceBoolean(literal);
    case "enum":
      return coerceEnum(literal, arg.enumValues);
    default:
      return literal;
  }
}
