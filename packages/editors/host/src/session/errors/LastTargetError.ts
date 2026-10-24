export class LastTargetError extends Error {
  readonly accepts: string;

  constructor(
    accepts: string
  ) {
    super(`The last ${accepts} asset cannot be deleted.`);
    this.name = "LastTargetError";
    this.accepts = accepts;
  }
}
