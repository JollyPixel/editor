// Import Internal Dependencies
import type { GolemCommand } from "../CommandBatch.ts";

// CONSTANTS
const kListedActions = 5;

export class CommandRefusedError extends Error {
  readonly commands: readonly GolemCommand[];

  constructor(
    commands: readonly GolemCommand[]
  ) {
    const actions = commands
      .slice(0, kListedActions)
      .map(({ action }) => JSON.stringify(action))
      .join(", ");
    const more = commands.length - kListedActions;
    super(
      `The studio refused ${commands.length} command(s) that conflict with ` +
      `the asset as it is now: ${actions}` +
      (more > 0 ? ` and ${more} more.` : ".")
    );
    this.name = "CommandRefusedError";
    this.commands = commands;
  }
}
