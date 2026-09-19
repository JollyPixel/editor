export class InvalidVoxelModelDocumentError extends Error {
  constructor(
    reason: string,
    options?: ErrorOptions
  ) {
    super(`Invalid voxel-model document: ${reason}.`, options);
    this.name = "InvalidVoxelModelDocumentError";
  }
}
