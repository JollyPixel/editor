export class InvalidEntryError extends Error {
  readonly entry: string;
  readonly id: string;

  constructor(
    entry: string,
    id: string,
    reason: string
  ) {
    super(`Invalid ${entry}: ${id} ${reason}.`);
    this.name = "InvalidEntryError";
    this.entry = entry;
    this.id = id;
  }
}
