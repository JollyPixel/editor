// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class UsernameTakenError extends AccountsError {
  constructor(
    username: string
  ) {
    super("username-taken", `the username "${username}" is taken`);
    this.name = "UsernameTakenError";
  }
}
