export class UnknownTagError extends Error {
  readonly assetId: string;
  readonly tagName: string;

  constructor(
    assetId: string,
    tagName: string
  ) {
    super(`Asset "${assetId}" has no tag named "${tagName}".`);
    this.name = "UnknownTagError";
    this.assetId = assetId;
    this.tagName = tagName;
  }
}
