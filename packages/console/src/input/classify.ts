// Import Internal Dependencies
import type {
  ConsoleRegistry,
  RegisteredCommand,
  RegisteredVariable
} from "../registry/types.ts";
import {
  tokenize,
  type Token
} from "./tokenize.ts";

export type InputMode = "command" | "variable" | "search";

export interface CommandInput {
  mode: "command";
  address: string;
  command: RegisteredCommand | undefined;
  tokens: Token[];
  unterminated: boolean;
}

export interface VariableInput {
  mode: "variable";
  variable: RegisteredVariable;
  tokens: Token[];
  unterminated: boolean;
}

export interface SearchInput {
  mode: "search";
  query: string;
  forced: boolean;
}

export type ClassifiedInput = CommandInput | VariableInput | SearchInput;

export function classify(
  input: string,
  registry: ConsoleRegistry
): ClassifiedInput {
  const trimmed = input.trimStart();
  if (trimmed.startsWith("?")) {
    return {
      mode: "search",
      query: trimmed.slice(1).trim(),
      forced: true
    };
  }

  const { tokens, unterminated } = tokenize(input);
  const head = tokens[0];
  if (
    head !== undefined &&
    !head.quoted &&
    head.value.startsWith("/")
  ) {
    const address = head.value.slice(1);

    return {
      mode: "command",
      address,
      command: registry.resolveCommand(address),
      tokens,
      unterminated
    };
  }

  const variable = head !== undefined && !head.quoted ?
    registry.resolveVariable(head.value) :
    undefined;
  if (variable !== undefined) {
    return {
      mode: "variable",
      variable,
      tokens,
      unterminated
    };
  }

  return {
    mode: "search",
    query: input.trim(),
    forced: false
  };
}
