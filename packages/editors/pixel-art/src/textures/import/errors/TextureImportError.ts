export class TextureImportError extends Error {
  constructor(
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "TextureImportError";
  }
}
