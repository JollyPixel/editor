export class CompanionReplacementError extends Error {
  readonly kind: string;
  readonly from: string;

  constructor(
    kind: string,
    from: string
  ) {
    super(
      `Asset kind "${kind}" cannot replace content from "${from}": ` +
      "the conversion creates companion assets."
    );
    this.name = "CompanionReplacementError";
    this.kind = kind;
    this.from = from;
  }
}
