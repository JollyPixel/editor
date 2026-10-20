export class InvalidTagNameError extends Error {
  readonly tagName: string;
  readonly limit: number;

  constructor(
    tagName: string,
    limit: number
  ) {
    super(
      `Invalid tag name "${tagName}": use 1 to ${limit} letters, digits, ` +
      "\".\", \"_\" or \"-\", starting with a letter or a digit."
    );
    this.name = "InvalidTagNameError";
    this.tagName = tagName;
    this.limit = limit;
  }
}
