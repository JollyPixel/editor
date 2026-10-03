export class InvalidNormalMapSettingsError extends Error {
  constructor(
    key: string,
    value: unknown
  ) {
    super(`Invalid normal map setting "${key}": ${JSON.stringify(value)}`);
    this.name = "InvalidNormalMapSettingsError";
  }
}
