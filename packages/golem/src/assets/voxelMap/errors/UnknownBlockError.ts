export class UnknownBlockError extends Error {
  readonly block: string | number;
  readonly candidates: readonly string[];

  constructor(
    block: string | number,
    candidates: readonly string[]
  ) {
    super(
      candidates.length === 0 ?
        `The map has no block ${JSON.stringify(block)}.` :
        `Block ${JSON.stringify(block)} is ambiguous: use one of ` +
        `${candidates.join(", ")}.`
    );
    this.name = "UnknownBlockError";
    this.block = block;
    this.candidates = candidates;
  }
}
