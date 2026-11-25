export class ProjectFolderError extends Error {
  constructor(
    message: string,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = "ProjectFolderError";
  }
}
