export class CommandRefusedError extends Error {
  readonly commands: readonly unknown[];

  constructor(
    commands: readonly unknown[]
  ) {
    super(
      `The studio refused ${commands.length} command(s) that conflict with ` +
      `the asset as it is now: ${JSON.stringify(commands)}`
    );
    this.name = "CommandRefusedError";
    this.commands = commands;
  }
}
