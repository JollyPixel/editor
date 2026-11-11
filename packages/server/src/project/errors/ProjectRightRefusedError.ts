export class ProjectRightRefusedError extends Error {
  constructor(
    message: string
  ) {
    super(message);
    this.name = "ProjectRightRefusedError";
  }
}
