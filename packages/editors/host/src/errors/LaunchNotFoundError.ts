export class LaunchNotFoundError extends Error {
  constructor() {
    super("No launch source named an asset to open.");
    this.name = "LaunchNotFoundError";
  }
}
