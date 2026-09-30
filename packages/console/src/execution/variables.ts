// Import Internal Dependencies
import type { VariableInput } from "../input/classify.ts";
import {
  coerceBoolean,
  coerceEnum,
  coerceNumber
} from "../input/coerce.ts";
import type {
  VariableDef,
  VariableSetResult
} from "../registry/types.ts";
import { ConsoleInputError } from "./errors/ConsoleInputError.ts";

export function accessVariable(
  input: VariableInput
): string {
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
    if (writeVariable(variable.def, literal) === false) {
      throw new ConsoleInputError(
        `${variable.address} rejected "${literal}"`
      );
    }
  }

  return String(variable.def.get());
}

function writeVariable(
  def: VariableDef,
  literal: string
): VariableSetResult {
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
