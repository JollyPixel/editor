// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class MasterPasswordRequiredError extends AccountsError {
  constructor() {
    super(
      "master-password-required",
      "registering needs the master password"
    );
    this.name = "MasterPasswordRequiredError";
  }
}
