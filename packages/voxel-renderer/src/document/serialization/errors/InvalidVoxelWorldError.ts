export class InvalidVoxelWorldError extends Error {
  constructor(
    reason: string,
    options?: { cause?: unknown; }
  ) {
    super(
      `Invalid voxel world: ${reason}`,
      options
    );
    this.name = "InvalidVoxelWorldError";
  }
}
