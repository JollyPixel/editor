export class ScriptBuildError extends Error {
  constructor(
    message: string,
    options: ErrorOptions = {}
  ) {
    super(message, options);
    this.name = "ScriptBuildError";
  }
}
