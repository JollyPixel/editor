export class InvalidPreferencesFileError extends Error {
  constructor(
    reason: string,
    options?: ErrorOptions
  ) {
    super(`not a preferences file: ${reason}`, options);
    this.name = "InvalidPreferencesFileError";
  }
}
