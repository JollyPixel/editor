// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class AccessRequestsFullError extends AccountsError {
  constructor(
    limit: number
  ) {
    super(
      "access-requests-full",
      `${limit} access requests already await approval`
    );
    this.name = "AccessRequestsFullError";
  }
}
