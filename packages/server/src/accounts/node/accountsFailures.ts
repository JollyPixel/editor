// Import Third-party Dependencies
import {
  AccountsError,
  type AccountsErrorCode
} from "@jolly-pixel/accounts";
import { AccountsThrottledError } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { ApiError } from "../../http/node/errors/ApiError.ts";

// CONSTANTS
const kErrorStatuses: Record<AccountsErrorCode, number> = {
  "invalid-username": 400,
  "invalid-password": 400,
  "username-taken": 409,
  "master-password-required": 403,
  "invalid-master-password": 403,
  "account-pending": 403,
  "access-requests-full": 429,
  "invalid-credentials": 401,
  "invalid-avatar": 422,
  throttled: 429,
  "share-link-not-found": 404,
  "share-link-refused": 403,
  "agent-token-not-found": 404,
  "agent-token-refused": 403
};

export function accountsFailures(
  error: Error
): ApiError | null {
  if (!(error instanceof AccountsError)) {
    return null;
  }

  return new ApiError(
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
