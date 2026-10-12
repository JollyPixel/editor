export class UnsettledChangesError extends Error {
  constructor(
    cause: unknown
  ) {
    super(
      "Changes are still being saved. Try again once they are.",
      { cause }
    );
    this.name = "UnsettledChangesError";
  }
}
