export class EventVersionConflictError extends Error {
  readonly assetId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(
    assetId: string,
    expectedVersion: number,
    actualVersion: number
  ) {
    super(
      `asset ${assetId} is at version ${actualVersion}, expected ${expectedVersion}`
    );
    this.name = "EventVersionConflictError";
    this.assetId = assetId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}
