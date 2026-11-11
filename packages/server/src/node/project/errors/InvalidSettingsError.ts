export class InvalidSettingsError extends Error {
  constructor(
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "InvalidSettingsError";
  }
}
