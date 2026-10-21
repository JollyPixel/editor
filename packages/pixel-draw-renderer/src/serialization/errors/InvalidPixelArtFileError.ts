export class InvalidPixelArtFileError extends Error {
  constructor(
    reason: string,
    options?: { cause?: unknown; }
  ) {
    super(`Invalid pixel-art file: ${reason}`, options);
    this.name = "InvalidPixelArtFileError";
  }
}
