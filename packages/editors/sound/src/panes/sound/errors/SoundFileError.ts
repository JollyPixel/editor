export class SoundFileError extends Error {
  constructor(
    message: string
  ) {
    super(message);
    this.name = "SoundFileError";
  }
}
