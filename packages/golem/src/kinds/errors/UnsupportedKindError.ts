export class UnsupportedKindError extends Error {
  readonly kind: string;

  constructor(
    kind: string,
    supported: Iterable<string>,
    options?: ErrorOptions
  ) {
    super(
      `Golem cannot open "${kind}" assets; it supports ${[...supported].join(", ")}.`,
      options
    );
    this.name = "UnsupportedKindError";
    this.kind = kind;
  }
}
