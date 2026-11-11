export class ContentUnavailableError extends Error {
  readonly hash: string;

  constructor(
    hash: string,
    reason: string,
    options?: ErrorOptions
  ) {
    super(`Asset content ${hash} is unavailable: ${reason}.`, options);
    this.name = "ContentUnavailableError";
    this.hash = hash;
  }
}
