// Import Internal Dependencies
import { coerce } from "../input/coerce.ts";
import type { CommandInput } from "../input/classify.ts";
import type { Token } from "../input/tokenize.ts";
import { label } from "../registry/format.ts";
import type {
  ArgDef,
  ConsoleScalar,
  RegisteredCommand
} from "../registry/types.ts";
import { ConsoleInputError } from "./errors/ConsoleInputError.ts";

export function bindArguments(
  command: RegisteredCommand,
  input: CommandInput,
  line: string
): Record<string, ConsoleScalar> {
  const { args } = command.def;
  const tokens = input.tokens.slice(1);
  const last = args.at(-1);
  const rest = last?.rest ? last : undefined;
  const positional = rest === undefined ? args : args.slice(0, -1);
  if (
    input.unterminated &&
    (rest === undefined || tokens.length <= positional.length)
  ) {
    throw new ConsoleInputError("Unterminated quote");
  }

  const values: Record<string, ConsoleScalar> = {};
  for (const [index, arg] of positional.entries()) {
    const token = tokens[index];
    if (token !== undefined) {
      values[arg.name] = coerce(token.value, arg);
    }
    else if (arg.required) {
      throw missingArgument(arg);
    }
  }

  const remaining = tokens.slice(positional.length);
  if (rest === undefined) {
    if (remaining.length > 0) {
      throw new ConsoleInputError(
        `${label(command)} takes ${args.length} argument(s), ` +
        `got ${tokens.length}`
      );
    }
  }
  else if (remaining.length > 0) {
    values[rest.name] = restValue(line, remaining);
  }
  else if (rest.required) {
    throw missingArgument(rest);
  }

  return values;
}

function restValue(
  line: string,
  tokens: Token[]
): string {
  if (tokens.length === 1) {
    return tokens[0].value;
  }

  return line.slice(tokens[0].start, tokens[tokens.length - 1].end);
}

function missingArgument(
  arg: ArgDef
): ConsoleInputError {
  return new ConsoleInputError(`Missing argument <${arg.name}>`);
}
