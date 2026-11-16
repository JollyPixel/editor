export class DuplicateProjectError extends Error {
  constructor(
    slug: string,
    other: string
  ) {
    super(
      `the project "${slug}" has the same id as the project "${other}"`
    );
    this.name = "DuplicateProjectError";
  }
}
