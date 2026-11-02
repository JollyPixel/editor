export class OpusEncoderUnavailableError extends Error {
  constructor(
    options?: ErrorOptions
  ) {
    super("No Opus encoder is available to convert the sound.", options);
    this.name = "OpusEncoderUnavailableError";
  }
}
