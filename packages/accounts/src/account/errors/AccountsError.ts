// CONSTANTS
export const ACCOUNTS_ERROR_CODES = [
  "invalid-username",
  "invalid-password",
  "username-taken",
  "master-password-required",
  "invalid-master-password",
  "account-pending",
  "access-requests-full",
  "invalid-credentials",
  "invalid-avatar",
  "throttled"
] as const;

export type AccountsErrorCode = typeof ACCOUNTS_ERROR_CODES[number];

export class AccountsError extends Error {
  readonly code: AccountsErrorCode;

  constructor(
    code: AccountsErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "AccountsError";
    this.code = code;
  }
}
