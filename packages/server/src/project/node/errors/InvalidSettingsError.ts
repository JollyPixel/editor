export class InvalidSettingsError extends TypeError {
  constructor(
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "InvalidSettingsError";
  }
}
