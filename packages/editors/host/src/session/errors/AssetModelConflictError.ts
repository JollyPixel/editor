export class AssetModelConflictError extends Error {
  constructor(
    assetId: string
  ) {
    super(
      `Asset "${assetId}" is already leased without this model kind.`
    );
    this.name = "AssetModelConflictError";
  }
}
