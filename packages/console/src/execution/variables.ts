// Import Internal Dependencies
import type { VariableInput } from "../input/classify.ts";
import {
  coerceBoolean,
  coerceEnum,
  coerceNumber
} from "../input/coerce.ts";
import type {
  ConsoleValue,
  RegisteredVariable,
  VariableDef,
  VariableSetResult
} from "../registry/types.ts";
import { ConsoleInputError } from "./errors/ConsoleInputError.ts";

export function peekValue(
  variable: RegisteredVariable
): ConsoleValue | undefined {
  try {
    return variable.def.get();
  }
  catch {
    return undefined;
  }
}

export function accessVariable(
  input: VariableInput
): string | Promise<string> {
  const { variable, tokens } = input;
  if (input.unterminated) {
    throw new ConsoleInputError("Unterminated quote");
  }
  if (tokens.length > 2) {
    throw new ConsoleInputError(
      `${variable.address} takes one value; quote a value containing spaces`
    );
  }

  if (tokens.length === 2) {
    const literal = tokens[1].value;
    const result = writeVariable(variable.def, literal);
    if (result instanceof Promise) {
      return result.then(
        (settled) => readBack(variable, literal, settled)
      );
    }

    return readBack(variable, literal, result);
  }

  return String(variable.def.get());
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

  return String(variable.def.get());
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
    default:
      return def.set(
        literal
      );
  }
}
