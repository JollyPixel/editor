export class SettingsRefusedError extends Error {
  constructor(
    message: string
  ) {
    super(message);
    this.name = "SettingsRefusedError";
  }
}
