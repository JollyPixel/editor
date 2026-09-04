export class InvalidPngError extends Error {
  constructor(
    reason: string,
    options?: { cause?: unknown; }
  ) {
    super(`Invalid PNG: ${reason}`, options);

    this.name = "InvalidPngError";
  }
}
