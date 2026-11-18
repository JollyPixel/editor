export class CommandDeniedError extends Error {
  readonly action: string;

  constructor(
    action: string,
    reason: string
  ) {
    super(`"${action}" is denied: ${reason}`);
    this.name = "CommandDeniedError";
    this.action = action;
  }
}
