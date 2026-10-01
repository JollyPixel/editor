export class AssetPathTakenError extends Error {
  readonly path: string;

  constructor(
    path: string
  ) {
    super(`"${path}" already exists.`);
    this.name = "AssetPathTakenError";
    this.path = path;
  }
}
