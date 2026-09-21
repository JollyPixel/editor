export type AssetArchiveRejection =
  | "corrupt"
  | "manifest-missing"
  | "manifest-invalid"
  | "unsupported-version"
  | "unsafe-path"
  | "reserved-path"
  | "duplicate"
  | "missing-entry"
  | "unexpected-entry"
  | "too-large"
  | "kind-mismatch"
  | "unreadable-asset"
  | "unknown-root";

export interface AssetArchiveErrorOptions {
  assetId?: string;
  cause?: unknown;
}

export class AssetArchiveError extends Error {
  readonly rejection: AssetArchiveRejection;
  readonly assetId: string | undefined;

  constructor(
    rejection: AssetArchiveRejection,
    message: string,
    options: AssetArchiveErrorOptions = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "AssetArchiveError";
    this.rejection = rejection;
    this.assetId = options.assetId;
  }
}
