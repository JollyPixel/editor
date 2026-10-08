export class ColorParseError extends Error {
  constructor(
    input: string
  ) {
    super(`Unable to parse color '${input}'`);
    this.name = "ColorParseError";
  }
}
