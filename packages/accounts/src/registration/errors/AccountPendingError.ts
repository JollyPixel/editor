// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class AccountPendingError extends AccountsError {
  constructor() {
    super(
      "account-pending",
      "the account awaits an admin's approval"
    );
    this.name = "AccountPendingError";
  }
}
