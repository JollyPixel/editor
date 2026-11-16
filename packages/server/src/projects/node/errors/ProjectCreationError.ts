export class ProjectCreationError extends Error {
  constructor(
    message: string,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = "ProjectCreationError";
  }
}
