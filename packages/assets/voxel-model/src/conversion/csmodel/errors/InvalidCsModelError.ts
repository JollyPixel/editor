export class InvalidCsModelError extends Error {
  constructor(
    reason: string,
    options?: ErrorOptions
  ) {
    super(`Invalid CraftStudio model: ${reason}.`, options);
    this.name = "InvalidCsModelError";
  }
}
