// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class InvitationRequiredError extends AccountsError {
  constructor() {
    super(
      "invitation-required",
      "the project takes new members on invitation only"
    );
    this.name = "InvitationRequiredError";
  }
}
