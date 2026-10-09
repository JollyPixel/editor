// CONSTANTS
export const ACCOUNTS_ERROR_CODES = [
  "cross-origin",
  "method-not-allowed",
  "length-required",
  "payload-too-large",
  "invalid-request",
  "invalid-username",
  "invalid-password",
  "username-taken",
  "master-password-required",
  "invalid-master-password",
  "invalid-credentials",
  "invalid-avatar",
  "not-found",
  "throttled",
  "unauthenticated",
  "unknown"
] as const;

export type AccountsErrorCode = typeof ACCOUNTS_ERROR_CODES[number];

export class AccountsRequestError extends Error {
  readonly status: number;
  readonly code: AccountsErrorCode;

  constructor(
    status: number,
    code: AccountsErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AccountsRequestError";
    this.status = status;
    this.code = code;
  }
}
