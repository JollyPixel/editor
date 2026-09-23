export class AssetDocumentConflictError extends Error {
  constructor(
    assetId: string
  ) {
    super(
      `Asset "${assetId}" is already leased without this document kind.`
    );
    this.name = "AssetDocumentConflictError";
  }
}
