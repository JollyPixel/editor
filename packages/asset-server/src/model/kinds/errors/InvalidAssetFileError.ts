export class InvalidAssetFileError extends Error {
  readonly kind: string;

  constructor(
    kind: string,
    reason: string,
    options?: ErrorOptions
  ) {
    super(`Invalid "${kind}" file: ${reason}.`, options);
    this.name = "InvalidAssetFileError";
    this.kind = kind;
  }
}
