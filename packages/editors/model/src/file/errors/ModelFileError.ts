export class ModelFileError extends Error {
  constructor(
    message: string
  ) {
    super(message);
    this.name = "ModelFileError";
  }
}
