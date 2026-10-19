export class AuditRefusedError extends Error {
  constructor() {
    super("this role cannot read the audit log");
    this.name = "AuditRefusedError";
  }
}
