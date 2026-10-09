// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class InvalidMasterPasswordError extends AccountsError {
  constructor() {
    super("invalid-master-password", "wrong master password");
    this.name = "InvalidMasterPasswordError";
  }
}
