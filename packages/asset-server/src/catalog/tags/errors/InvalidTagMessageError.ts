export class InvalidTagMessageError extends Error {
  readonly length: number;
  readonly limit: number;

  constructor(
    length: number,
    limit: number
  ) {
    super(`Tag message of ${length} characters exceeds the ${limit} limit.`);
    this.name = "InvalidTagMessageError";
    this.length = length;
    this.limit = limit;
  }
}
