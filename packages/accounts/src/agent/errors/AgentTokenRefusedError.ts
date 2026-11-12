// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class AgentTokenRefusedError extends AccountsError {
  constructor(
    message: string
  ) {
    super(
      "agent-token-refused",
      message
    );
    this.name = "AgentTokenRefusedError";
  }
}
