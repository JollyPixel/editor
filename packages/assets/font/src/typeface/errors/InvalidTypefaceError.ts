export class InvalidTypefaceError extends Error {
  constructor(
    reason: string,
    options?: ErrorOptions
  ) {
    super(`Invalid typeface: ${reason}.`, options);
    this.name = "InvalidTypefaceError";
  }
}
