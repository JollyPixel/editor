export class PlaceholderCollisionError extends Error {
  constructor(
    key: string
  ) {
    super(`an object whose only key is "${key}" cannot be sent`);
    this.name = "PlaceholderCollisionError";
  }
}
