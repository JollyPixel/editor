/**
 * Reports a persisted asset manifest version unsupported by this package.
 */
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
