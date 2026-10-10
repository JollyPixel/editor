// Import Third-party Dependencies
import type { AccountsFailureCode } from "@jolly-pixel/accounts";

export class ApiError extends Error {
  readonly status: number;
  readonly code: AccountsFailureCode;
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    status: number,
    code: AccountsFailureCode,
    message: string,
    headers: Record<string, string> = {}
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.headers = {
      ...headers
    };
  }
}
