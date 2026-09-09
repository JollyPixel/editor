export class InvalidPixelArtDocumentError extends Error {
  constructor(
    reason: string,
    options?: { cause?: unknown; }
  ) {
    super(`Invalid pixel-art document: ${reason}`, options);
    this.name = "InvalidPixelArtDocumentError";
  }
}
