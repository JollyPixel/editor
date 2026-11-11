export class ScriptImportError extends Error {
  constructor(
    message: string
  ) {
    super(message);
    this.name = "ScriptImportError";
  }
}
