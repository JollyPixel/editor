export class UnknownScopeError extends Error {
  constructor(
    scope: string
  ) {
    super(`no "${scope}" preference scope`);
    this.name = "UnknownScopeError";
  }
}
