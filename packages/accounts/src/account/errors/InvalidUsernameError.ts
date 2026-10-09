// Import Internal Dependencies
import { AccountsError } from "./AccountsError.ts";

export class InvalidUsernameError extends AccountsError {
  constructor(
    message: string
  ) {
    super("invalid-username", message);
    this.name = "InvalidUsernameError";
  }
}
