export class UnknownEventError extends Error {
  readonly assetId: string;
  readonly eventVersion: number;

  constructor(
    assetId: string,
    eventVersion: number
  ) {
    super(
      `asset ${assetId} has no event at version ${eventVersion}`
    );
    this.name = "UnknownEventError";
    this.assetId = assetId;
    this.eventVersion = eventVersion;
  }
}
