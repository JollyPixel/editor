export class InvalidVoxelMapDocumentError extends Error {
  constructor(
    reason: string,
    options?: { cause?: unknown; }
  ) {
    super(
      `Invalid voxel-map document: ${reason}`,
      options
    );
    this.name = "InvalidVoxelMapDocumentError";
  }
}
