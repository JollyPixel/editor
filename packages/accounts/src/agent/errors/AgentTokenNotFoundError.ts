// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class AgentTokenNotFoundError extends AccountsError {
  constructor() {
    super(
      "agent-token-not-found",
      "no agent token of this account has this id"
    );
    this.name = "AgentTokenNotFoundError";
  }
}
