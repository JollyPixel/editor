// CONSTANTS
const kExpectedKinds = new Intl.ListFormat("en", {
  type: "disjunction"
});

export class KindMismatchError extends Error {
  readonly assetId: string;
  readonly kind: string;

  constructor(
    assetId: string,
    kind: string,
    expected: readonly string[]
  ) {
    const wanted = kExpectedKinds.format(expected);
    super(
      `Asset "${assetId}" is ${withArticle(kind)}, not ${withArticle(wanted)}.`
    );
    this.name = "KindMismatchError";
    this.assetId = assetId;
    this.kind = kind;
  }
}

function withArticle(
  noun: string
): string {
  return /^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}
