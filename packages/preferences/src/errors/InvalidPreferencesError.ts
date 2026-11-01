export class InvalidPreferencesError extends Error {
  readonly scope: string;

  constructor(
    scope: string,
    message: string
  ) {
    super(`Invalid "${scope}" preferences: ${message}`);
    this.name = "InvalidPreferencesError";
    this.scope = scope;
  }
}
