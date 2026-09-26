export class InvalidAssetDocumentError extends Error {
  readonly kind: string;

  constructor(
    kind: string,
    reason: string,
    options?: ErrorOptions
  ) {
    super(`Invalid "${kind}" document: ${reason}.`, options);
    this.name = "InvalidAssetDocumentError";
    this.kind = kind;
  }
}
