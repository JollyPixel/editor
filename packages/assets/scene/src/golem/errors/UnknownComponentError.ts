export class UnknownComponentError extends Error {
  readonly type: string;
  readonly known: readonly string[];

  constructor(
    type: string,
    known: readonly string[]
  ) {
    super(
      `The studio has no "${type}" component. ` +
      `Its components: ${known.join(", ") || "none"}.`
    );
    this.name = "UnknownComponentError";
    this.type = type;
    this.known = known;
  }
}
