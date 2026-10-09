// Import Internal Dependencies
import type { AccountsErrorCode } from "../../account/errors/AccountsError.ts";
import { HTTP_ERROR_CODES } from "../core/errors/HttpError.ts";

// CONSTANTS
export const ACCOUNTS_URL_PATH = "/api/accounts/";
export const ACCOUNTS_ROUTES = {
  register: {
    method: "POST",
    path: "register"
  },
  login: {
    method: "POST",
    path: "login"
  },
  logout: {
    method: "POST",
    path: "logout"
  },
  me: {
    method: "GET",
    path: "me"
  },
  replaceAvatar: {
    method: "PUT",
    path: "avatar"
  },
  avatar: {
    method: "GET",
    path: ":accountId/avatar"
  }
} as const;
export const ACCOUNTS_REQUEST_ERROR_CODES = [
  ...HTTP_ERROR_CODES,
  "not-found",
  "unauthenticated",
  "unknown"
] as const;
export const AVATAR_VERSION_PARAM = "v";

export type AccountsRouteName = keyof typeof ACCOUNTS_ROUTES;
export type AccountsRequestErrorCode =
  typeof ACCOUNTS_REQUEST_ERROR_CODES[number];
export type AccountsFailureCode = AccountsErrorCode | AccountsRequestErrorCode;

export function avatarPath(
  prefix: string,
  accountId: string,
  hash: string
): string {
  const path = ACCOUNTS_ROUTES.avatar.path.replace(":accountId", accountId);

  return `${prefix}${path}?${AVATAR_VERSION_PARAM}=${hash}`;
}
