export class ProjectExportRefusedError extends Error {
  constructor() {
    super("this role cannot export the project");
    this.name = "ProjectExportRefusedError";
  }
}
