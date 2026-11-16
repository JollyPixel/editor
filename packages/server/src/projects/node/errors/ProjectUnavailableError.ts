export class ProjectUnavailableError extends Error {
  constructor(
    slug: string,
    cause: unknown
  ) {
    super(
      `the project "${slug}" cannot open: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause }
    );
    this.name = "ProjectUnavailableError";
  }
}
