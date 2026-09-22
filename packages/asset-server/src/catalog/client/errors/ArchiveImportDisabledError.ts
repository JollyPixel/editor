export class ArchiveImportDisabledError extends Error {
  constructor() {
    super("Importing archives is disabled.");
    this.name = "ArchiveImportDisabledError";
  }
}
