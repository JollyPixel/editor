export class ArchiveImportDisabledError extends Error {
  constructor() {
    super("This workspace does not persist: importing is disabled.");
    this.name = "ArchiveImportDisabledError";
  }
}
