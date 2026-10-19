// Import Third-party Dependencies
import type { AccountsFailureCode } from "@jolly-pixel/accounts";

export type ApiFailureCode =
  | AccountsFailureCode
  | "export-refused"
  | "settings-refused"
  | "audit-refused"
  | "invalid-settings"
  | "role-in-use";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiFailureCode;
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    status: number,
    code: ApiFailureCode,
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
