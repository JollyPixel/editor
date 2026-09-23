export class CatalogUnavailableError extends Error {
  constructor() {
    super("The asset catalog did not become available.");
    this.name = "CatalogUnavailableError";
  }
}
