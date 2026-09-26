export class InvalidTilesetDocumentError extends Error {
  constructor(
    message: string,
    options?: ErrorOptions
  ) {
    super(`Invalid tileset document: ${message}`, options);
    this.name = "InvalidTilesetDocumentError";
  }
}
