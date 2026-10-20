export class UnknownAssetKindError extends Error {
  readonly kind: string;

  constructor(
    kind: string
  ) {
    super(`No handler is registered for asset kind "${kind}".`);
    this.name = "UnknownAssetKindError";
    this.kind = kind;
  }
}
