// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class InvalidPasswordError extends AccountsError {
  constructor(
    message: string
  ) {
    super("invalid-password", message);
    this.name = "InvalidPasswordError";
  }
}
