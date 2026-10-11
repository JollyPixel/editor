export class EventTagConflictError extends Error {
  readonly assetId: string;
  readonly tagName: string;

  constructor(
    assetId: string,
    tagName: string,
    options?: ErrorOptions
  ) {
    super(
      `asset ${assetId} already has a tag named "${tagName}"`,
      options
    );
    this.name = "EventTagConflictError";
    this.assetId = assetId;
    this.tagName = tagName;
  }
}
