export class CommandInvalidError extends Error {
  readonly index: number;

  constructor(
    index: number,
    reason: string
  ) {
    super(`Command ${index} is invalid: ${reason}`);
    this.name = "CommandInvalidError";
    this.index = index;
  }
}
