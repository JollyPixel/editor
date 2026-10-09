// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class AccountsThrottledError extends AccountsError {
  readonly retryAfterMs: number;

  constructor(
    retryAfterMs: number,
    message: string
  ) {
    super("throttled", message);
    this.name = "AccountsThrottledError";
    this.retryAfterMs = retryAfterMs;
  }
}
