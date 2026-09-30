// Import Internal Dependencies
import { coerce } from "../input/coerce.ts";
import type { CommandInput } from "../input/classify.ts";
import { label } from "../registry/format.ts";
import type {
  ConsoleValue,
  RegisteredCommand
} from "../registry/types.ts";
import { ConsoleInputError } from "./errors/ConsoleInputError.ts";

export function bindArguments(
  command: RegisteredCommand,
  input: CommandInput,
  line: string
): Record<string, ConsoleValue> {
  const args = command.def.args;
  const tokens = input.tokens.slice(1);
  const values: Record<string, ConsoleValue> = {};

  const restIndex = args.at(-1)?.rest ? args.length - 1 : -1;
  if (
    input.unterminated &&
    (restIndex === -1 || tokens.length - 1 < restIndex)
  ) {
    throw new ConsoleInputError("Unterminated quote");
  }

  for (const [index, arg] of args.entries()) {
    if (index === restIndex) {
      const remaining = tokens.slice(index);
      if (remaining.length === 1) {
        values[arg.name] = remaining[0].value;
      }
      else if (remaining.length > 1) {
        const last = remaining[remaining.length - 1];
        values[arg.name] = line.slice(remaining[0].start, last.end);
      }
      else if (arg.required) {
        throw new ConsoleInputError(`Missing argument <${arg.name}>`);
      }
      break;
    }

    const token = tokens[index];
    if (token === undefined) {
      if (arg.required) {
        throw new ConsoleInputError(`Missing argument <${arg.name}>`);
      }
      continue;
    }
    values[arg.name] = coerce(token.value, arg);
  }

  if (restIndex === -1 && tokens.length > args.length) {
    throw new ConsoleInputError(
      `${label(command)} takes ${args.length} argument(s), ` +
      `got ${tokens.length}`
    );
  }

  return values;
}
