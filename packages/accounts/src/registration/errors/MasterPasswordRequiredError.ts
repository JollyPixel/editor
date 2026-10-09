export class MasterPasswordRequiredError extends Error {
  constructor() {
    super("registering needs the master password");
    this.name = "MasterPasswordRequiredError";
  }
}
