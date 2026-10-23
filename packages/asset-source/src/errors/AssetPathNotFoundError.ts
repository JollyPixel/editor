export class AssetPathNotFoundError extends Error {
  readonly path: string;

  constructor(
    path: string,
    options?: ErrorOptions
  ) {
    super(`Asset "${path}" not found.`, options);
    this.name = "AssetPathNotFoundError";
    this.path = path;
  }
}
