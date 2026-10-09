export class InvalidMasterPasswordError extends Error {
  constructor() {
    super("wrong master password");
    this.name = "InvalidMasterPasswordError";
  }
}
