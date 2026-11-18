export class UnknownEntryError extends Error {
  readonly entry: string;
  readonly ref: string;
  readonly candidates: readonly string[];

  constructor(
    entry: string,
    ref: string,
    candidates: readonly string[]
  ) {
    super(
      candidates.length === 0 ?
        `There is no ${entry} ${JSON.stringify(ref)}.` :
        `The ${entry} name ${JSON.stringify(ref)} is ambiguous: use one of ` +
        `${candidates.join(", ")}.`
    );
    this.name = "UnknownEntryError";
    this.entry = entry;
    this.ref = ref;
    this.candidates = candidates;
  }
}
