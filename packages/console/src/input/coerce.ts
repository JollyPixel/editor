// Import Internal Dependencies
import type {
  ArgDef,
  ConsoleScalar,
  ConsoleValue,
  ListVariableDef,
  VariableDef
} from "../registry/types.ts";
import { InvalidValueError } from "./errors/InvalidValueError.ts";
import {
  quote,
  tokenize
} from "./tokenize.ts";

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

export function coerceList<TItem extends ConsoleScalar>(
  literal: string,
  coerceItem: (item: string) => TItem
): TItem[] {
  const { tokens, unterminated } = tokenize(literal);
  if (unterminated) {
    throw new InvalidValueError(literal, "a closing quote");
  }
  if (tokens.length === 1 && tokens[0].quoted && tokens[0].value === "") {
    return [];
  }

  return tokens.map((token) => {
    if (token.value === "") {
      throw new InvalidValueError(literal, "a list without empty items");
    }

    return coerceItem(token.value);
  });
}

export function isListVariable(
  def: VariableDef
): def is ListVariableDef {
  switch (def.type) {
    case "string[]":
    case "number[]":
    case "boolean[]":
      return true;
    default:
      return false;
  }
}

export function coerce(
  literal: string,
  arg: ArgDef
): ConsoleScalar;
export function coerce(
  literal: string,
  arg: VariableDef
): ConsoleValue;
export function coerce(
  literal: string,
  arg: ArgDef | VariableDef
): ConsoleValue {
  switch (arg.type) {
    case "number":
      return coerceNumber(literal);
    case "boolean":
      return coerceBoolean(literal);
    case "enum":
      return coerceEnum(literal, arg.enumValues);
    case "string[]":
      return coerceList(literal, (item) => item);
    case "number[]":
      return coerceList(literal, coerceNumber);
    case "boolean[]":
      return coerceList(literal, coerceBoolean);
    default:
      return literal;
  }
}

export function formatValue(
  value: ConsoleValue
): string {
  if (typeof value !== "object") {
    return String(value);
  }

  return value.length === 0 ?
    quote("") :
    value.map((item) => quote(String(item))).join(" ");
}

export function promptLiteral(
  value: ConsoleValue
): string {
  return typeof value === "object" ?
    formatValue(value) :
    quote(String(value));
}
