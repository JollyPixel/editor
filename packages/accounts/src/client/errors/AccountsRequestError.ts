// Import Internal Dependencies
import type { AccountsFailureCode } from "../../http/routes.ts";

export class AccountsRequestError extends Error {
  readonly status: number;
  readonly code: AccountsFailureCode;

  constructor(
    status: number,
    code: AccountsFailureCode,
    message: string
  ) {
    super(message);
    this.name = "AccountsRequestError";
    this.status = status;
    this.code = code;
  }
}
