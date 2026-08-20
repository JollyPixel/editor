export class AssetPathEscapeError extends Error {
  readonly path: string;

  constructor(
    path: string
  ) {
    super(`Asset path "${path}" escapes the source root.`);
    this.name = "AssetPathEscapeError";
    this.path = path;
  }
}
