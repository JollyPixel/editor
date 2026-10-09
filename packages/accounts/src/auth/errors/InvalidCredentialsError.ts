// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class InvalidCredentialsError extends AccountsError {
  constructor() {
    super("invalid-credentials", "wrong username or password");
    this.name = "InvalidCredentialsError";
  }
}
