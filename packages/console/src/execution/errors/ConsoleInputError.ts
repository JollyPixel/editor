export class ConsoleInputError extends Error {
  constructor(
    message: string
  ) {
    super(message);

    this.name = "ConsoleInputError";
  }
}
