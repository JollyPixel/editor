export class MissingResourceError extends Error {
  constructor(
    name: string
  ) {
    super(`This model needs "${name}", a file stored outside it.`);
    this.name = "MissingResourceError";
  }
}
