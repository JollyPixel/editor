export class InvalidAnimationSetError extends Error {
  readonly clipId: string | null;

  constructor(
    clipId: string | null,
    reason: string
  ) {
    super(`Invalid animation set: ${clipId === null ? "set" : `clip ${clipId}`} ${reason}.`);
    this.name = "InvalidAnimationSetError";
    this.clipId = clipId;
  }
}
