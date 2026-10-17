export class UnsupportedAssetManifestError extends Error {
  readonly version: number;

  constructor(
    version: number
  ) {
    super(`Asset manifest version "${version}" is not supported.`);
    this.name = "UnsupportedAssetManifestError";
    this.version = version;
  }
}
