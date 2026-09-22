export class InvalidValueError extends Error {
  constructor(
    literal: string,
    expected: string
  ) {
    super(`Expected ${expected}, got "${literal}"`);

    this.name = "InvalidValueError";
  }
}
