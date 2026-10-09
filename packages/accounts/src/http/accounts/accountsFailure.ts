// Import Internal Dependencies
import {
  AccountsError,
  type AccountsErrorCode
} from "../../account/errors/AccountsError.ts";
import { AccountsThrottledError } from "../../auth/errors/AccountsThrottledError.ts";
import { HttpError } from "../core/errors/HttpError.ts";

// CONSTANTS
const kErrorStatuses: Record<AccountsErrorCode, number> = {
  "invalid-username": 400,
  "invalid-password": 400,
  "username-taken": 409,
  "master-password-required": 403,
  "invalid-master-password": 403,
  "invalid-credentials": 401,
  "invalid-avatar": 422,
  throttled: 429
};

export function accountsFailure(
  error: unknown
): HttpError | null {
  if (!(error instanceof AccountsError)) {
    return null;
  }

  return new HttpError(
    kErrorStatuses[error.code],
    error.code,
    error.message,
    error instanceof AccountsThrottledError ?
      {
        "retry-after": String(Math.ceil(error.retryAfterMs / 1_000))
      } :
      {}
  );
}
