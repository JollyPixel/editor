export class ArgumentOrderError extends Error {
  constructor(
    command: string,
    argument: string
  ) {
    super(
      `Command "${command}": optional argument "${argument}" ` +
      "comes before a required one"
    );

    this.name = "ArgumentOrderError";
  }
}
