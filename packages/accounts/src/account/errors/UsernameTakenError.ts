// Import Internal Dependencies
import { AccountsError } from "./AccountsError.ts";

export class UsernameTakenError extends AccountsError {
  constructor(
    username: string
  ) {
    super("username-taken", `the username "${username}" is taken`);
    this.name = "UsernameTakenError";
  }
}
