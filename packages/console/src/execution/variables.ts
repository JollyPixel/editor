// Import Internal Dependencies
import type { VariableInput } from "../input/classify.ts";
import {
  coerceBoolean,
  coerceEnum,
  coerceList,
  coerceNumber,
  formatValue,
  isListVariable
} from "../input/coerce.ts";
import type {
  ConsoleRegistry,
  ConsoleScalar,
  ConsoleValue,
  RegisteredVariable,
  Revert,
  VariableDef,
  VariableSetResult
} from "../registry/types.ts";
import { ConsoleInputError } from "./errors/ConsoleInputError.ts";

export function readVariable(
  variable: RegisteredVariable
): ConsoleValue {
  const value = variable.def.get();
  if (typeof value !== "object") {
    return value;
  }

  const items: readonly ConsoleScalar[] = value;
  if (items.includes("")) {
    throw new ConsoleInputError(`${variable.address} holds an empty item`);
  }

  return [...items];
}

export function peekValue(
  variable: RegisteredVariable
): ConsoleValue | undefined {
  try {
    return readVariable(variable);
  }
  catch {
    return undefined;
  }
}

export function accessVariable(
  input: VariableInput
): string | Promise<string> {
  const { variable, tokens } = input;
  const isList = isListVariable(variable.def);
  if (input.unterminated) {
    throw new ConsoleInputError("Unterminated quote");
  }
  if (tokens.length > 2 && !isList) {
    throw new ConsoleInputError(
      `${variable.address} takes one value; quote a value containing spaces`
    );
  }

  if (tokens.length > 1) {
    const literal = isList ?
      input.line.slice(tokens[1].start).trimEnd() :
      tokens[1].value;
    const result = writeVariable(variable.def, literal);
    if (result instanceof Promise) {
      return result.then(
        (settled) => readBack(variable, literal, settled)
      );
    }

    return readBack(variable, literal, result);
  }

  return formatValue(readVariable(variable));
}

function readBack(
  variable: RegisteredVariable,
  literal: string,
  result: VariableSetResult
): string {
  if (result === false) {
    throw new ConsoleInputError(
      `${variable.address} rejected "${literal}"`
    );
  }

  return formatValue(readVariable(variable));
}

export function restoreVariable(
  registry: ConsoleRegistry,
  address: string,
  previous: ConsoleValue
): Revert {
  return async() => {
    const variable = registry.resolveVariable(address);
    if (variable === undefined) {
      throw new ConsoleInputError(`Unknown variable "${address}"`);
    }

    const literal = formatValue(previous);
    const result = await writeVariable(variable.def, literal);
    if (result === false) {
      throw new ConsoleInputError(`${address} rejected "${literal}"`);
    }
  };
}

export function writeVariable(
  def: VariableDef,
  literal: string
): VariableSetResult | Promise<VariableSetResult> {
  switch (def.type) {
    case "number":
      return def.set(
        coerceNumber(literal)
      );
    case "boolean":
      return def.set(
        coerceBoolean(literal)
      );
    case "enum":
      return def.set(
        coerceEnum(
          literal,
          def.enumValues
        )
      );
    case "string[]":
      return def.set(
        coerceList(literal, (item) => item)
      );
    case "number[]":
      return def.set(
        coerceList(literal, coerceNumber)
      );
    case "boolean[]":
      return def.set(
        coerceList(literal, coerceBoolean)
      );
    default:
      return def.set(
        literal
      );
  }
}

export interface VariableRestore {
  readonly address: string;
  readonly previous: ConsoleValue;
}

export function restoreVariables(
  registry: ConsoleRegistry,
  restores: readonly VariableRestore[]
): Revert {
  return async() => {
    for (const { address, previous } of restores.toReversed()) {
      if (registry.resolveVariable(address) !== undefined) {
        await restoreVariable(registry, address, previous)();
      }
    }
  };
}
