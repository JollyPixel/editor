export class TextEditMismatchError extends Error {
  readonly at: number;

  constructor(
    at: number
  ) {
    super(`The text edit does not match the text at offset ${at}.`);
    this.name = "TextEditMismatchError";
    this.at = at;
  }
}
