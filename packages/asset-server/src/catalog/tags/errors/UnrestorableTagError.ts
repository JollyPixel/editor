export class UnrestorableTagError extends Error {
  readonly assetId: string;
  readonly tagName: string;

  constructor(
    assetId: string,
    tagName: string
  ) {
    super(
      `Tag "${tagName}" of asset "${assetId}" does not point at saved content.`
    );
    this.name = "UnrestorableTagError";
    this.assetId = assetId;
    this.tagName = tagName;
  }
}
