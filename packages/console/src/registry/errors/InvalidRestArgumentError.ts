export class InvalidRestArgumentError extends Error {
  constructor(
    command: string,
    argument: string
  ) {
    super(
      `Command "${command}": rest argument "${argument}" ` +
      "must be the last one and of type string"
    );

    this.name = "InvalidRestArgumentError";
  }
}
