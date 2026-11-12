export class UnsupportedKindError extends Error {
  readonly kind: string;

  constructor(
    kind: string,
    supported: Iterable<string>
  ) {
    super(
      `Golem cannot open "${kind}" assets; it supports ${[...supported].join(", ")}.`
    );
    this.name = "UnsupportedKindError";
    this.kind = kind;
  }
}
