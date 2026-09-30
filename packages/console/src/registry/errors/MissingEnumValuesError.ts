export class MissingEnumValuesError extends Error {
  constructor(
    name: string
  ) {
    super(`"${name}" has type enum but no enumValues`);

    this.name = "MissingEnumValuesError";
  }
}
