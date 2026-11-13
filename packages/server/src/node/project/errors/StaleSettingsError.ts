export class StaleSettingsError extends Error {
  constructor() {
    super("the project settings changed since they were read");
    this.name = "StaleSettingsError";
  }
}
