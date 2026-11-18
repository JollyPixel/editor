// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { CommandInvalidError } from "./errors/CommandInvalidError.ts";

// CONSTANTS
export const MAX_BATCH_COMMANDS = 500;

export interface GolemCommand {
  action: string;
}

export class CommandBatch<TCommand extends GolemCommand> {
  readonly commands: readonly TCommand[];

  constructor(
    commands: Iterable<unknown>,
    schema: z.ZodMiniType<TCommand>
  ) {
    const list = [...commands];
    if (list.length > MAX_BATCH_COMMANDS) {
      throw new RangeError(
        `A batch holds at most ${MAX_BATCH_COMMANDS} commands, got ${list.length}.`
      );
    }

    this.commands = list.map((command, index) => {
      const parsed = z.safeParse(schema, command);
      if (!parsed.success) {
        throw new CommandInvalidError(index, z.prettifyError(parsed.error));
      }

      return parsed.data;
    });
  }
}
