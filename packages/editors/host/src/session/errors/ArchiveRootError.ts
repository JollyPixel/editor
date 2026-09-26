export class ArchiveRootError extends Error {
  readonly accepts: string;

  constructor(
    accepts: string
  ) {
    super("The archive does not hold an asset this editor can open.");
    this.name = "ArchiveRootError";
    this.accepts = accepts;
  }
}
