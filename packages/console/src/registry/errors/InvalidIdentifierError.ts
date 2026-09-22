export class InvalidIdentifierError extends Error {
  constructor(
    name: string
  ) {
    super(`Invalid identifier "${name}": expected [A-Za-z_][A-Za-z0-9_-]*`);

    this.name = "InvalidIdentifierError";
  }
}
