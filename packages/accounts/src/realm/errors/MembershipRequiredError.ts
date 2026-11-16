// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class MembershipRequiredError extends AccountsError {
  constructor() {
    super(
      "membership-required",
      "the account is not a member of the project"
    );
    this.name = "MembershipRequiredError";
  }
}
