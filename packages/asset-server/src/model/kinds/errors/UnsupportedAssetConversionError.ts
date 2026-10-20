export class UnsupportedAssetConversionError extends Error {
  readonly kind: string;
  readonly from: string;

  constructor(
    kind: string,
    from: string
  ) {
    super(`Asset kind "${kind}" cannot be created from "${from}" content.`);
    this.name = "UnsupportedAssetConversionError";
    this.kind = kind;
    this.from = from;
  }
}
