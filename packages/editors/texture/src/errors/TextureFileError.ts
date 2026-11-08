export class TextureFileError extends Error {
  constructor(
    message: string
  ) {
    super(message);
    this.name = "TextureFileError";
  }
}
