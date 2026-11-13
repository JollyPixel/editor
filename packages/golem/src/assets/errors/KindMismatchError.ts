export class KindMismatchError extends Error {
  readonly assetId: string;
  readonly kind: string;

  constructor(
    assetId: string,
    kind: string,
    expected: readonly string[]
  ) {
    const last = expected.at(-1);
    const wanted = expected.length > 1 ?
      `${expected.slice(0, -1).join(", ")} or ${last}` :
      last;
    super(`Asset "${assetId}" is a ${kind}, not a ${wanted}.`);
    this.name = "KindMismatchError";
    this.assetId = assetId;
    this.kind = kind;
  }
}
