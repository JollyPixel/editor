export class DuplicateArgumentError extends Error {
  constructor(
    command: string,
    argument: string
  ) {
    super(`Command "${command}": argument "${argument}" is declared twice`);

    this.name = "DuplicateArgumentError";
  }
}
