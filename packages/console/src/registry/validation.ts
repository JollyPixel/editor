// Import Internal Dependencies
import type {
  ArgDef,
  VariableDef
} from "./types.ts";
import { ArgumentOrderError } from "./errors/ArgumentOrderError.ts";
import { DuplicateArgumentError } from "./errors/DuplicateArgumentError.ts";
import { InvalidIdentifierError } from "./errors/InvalidIdentifierError.ts";
import { InvalidRestArgumentError } from "./errors/InvalidRestArgumentError.ts";
import { MissingEnumValuesError } from "./errors/MissingEnumValuesError.ts";

// CONSTANTS
const kIdentifier = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function isIdentifier(
  name: string
): boolean {
  return kIdentifier.test(name);
}

export function assertIdentifier(
  name: string
): void {
  if (!isIdentifier(name)) {
    throw new InvalidIdentifierError(name);
  }
}

export function assertArgs(
  command: string,
  args: readonly ArgDef[]
): void {
  const names = new Set<string>();
  let optionalSeen: string | null = null;

  for (const [index, arg] of args.entries()) {
    assertIdentifier(arg.name);
    if (names.has(arg.name)) {
      throw new DuplicateArgumentError(command, arg.name);
    }
    names.add(arg.name);

    if (arg.type === "enum" && !hasEnumValues(arg.enumValues)) {
      throw new MissingEnumValuesError(`${command} ${arg.name}`);
    }
    if (arg.rest && (index !== args.length - 1 || arg.type !== "string")) {
      throw new InvalidRestArgumentError(command, arg.name);
    }

    if (arg.required) {
      if (optionalSeen !== null) {
        throw new ArgumentOrderError(command, optionalSeen);
      }
    }
    else {
      optionalSeen ??= arg.name;
    }
  }
}

export function assertVariableDef(
  name: string,
  def: VariableDef
): void {
  if (def.type === "enum" && !hasEnumValues(def.enumValues)) {
    throw new MissingEnumValuesError(name);
  }
}

function hasEnumValues(
  values: readonly string[] | undefined
): boolean {
  return values !== undefined && values.length > 0;
}
