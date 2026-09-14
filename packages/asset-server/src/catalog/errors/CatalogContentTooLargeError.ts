export class CatalogContentTooLargeError extends Error {
  readonly size: number;
  readonly limit: number;

  constructor(
    size: number,
    limit: number
  ) {
    super(`Content of ${size} bytes exceeds the ${limit} bytes limit.`);
    this.name = "CatalogContentTooLargeError";
    this.size = size;
    this.limit = limit;
  }
}
