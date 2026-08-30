export class InvalidVoxelDocumentError extends Error {
  constructor(
    reason: string,
    options?: { cause?: unknown; }
  ) {
    super(
      `Invalid voxel document: ${reason}`,
      options
    );
    this.name = "InvalidVoxelDocumentError";
  }
}
