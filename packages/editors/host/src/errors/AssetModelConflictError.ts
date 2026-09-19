export class AssetModelConflictError extends Error {
  constructor(
    assetId: string
  ) {
    super(
      `Asset "${assetId}" is already leased without a model.`
    );
    this.name = "AssetModelConflictError";
  }
}
