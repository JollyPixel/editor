export class UnknownProjectError extends Error {
  constructor(
    slug: string
  ) {
    super(`no project is named "${slug}"`);
    this.name = "UnknownProjectError";
  }
}
