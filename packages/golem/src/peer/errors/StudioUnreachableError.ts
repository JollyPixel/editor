export class StudioUnreachableError extends Error {
  readonly url: string;

  constructor(
    url: string,
    options?: ErrorOptions
  ) {
    super(
      `The studio at ${url} is not reachable: start it, then try again.`,
      options
    );
    this.name = "StudioUnreachableError";
    this.url = url;
  }
}
