// Import Node.js Dependencies
import { createHash } from "node:crypto";
import path from "node:path";

// Import Third-party Dependencies
import { STATE_DIRECTORY } from "@jolly-pixel/asset-source";
import {
  Accounts,
  AccountRoles,
  IN_MEMORY_LOCATION,
  SessionCookie
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import type { StudioProject } from "./StudioProject.ts";

// CONSTANTS
const kDatabaseFile = "accounts.db";
const kCookiePrefix = "jolly_session_";
export const ACCOUNTS_STATE_IGNORES = [
  kDatabaseFile,
  `${kDatabaseFile}-journal`,
  `${kDatabaseFile}-wal`,
  `${kDatabaseFile}-shm`
];

export interface StudioAccountsOptions {
  /**
   * Keeps accounts in memory instead of the project state directory.
   * @default false
   */
  inMemory?: boolean;
  /**
   * Role of new accounts, in place of the project's `access.defaultRole`.
   */
  defaultRole?: string;
}

export function openStudioAccounts(
  project: StudioProject,
  options: StudioAccountsOptions = {}
): Promise<Accounts> {
  const { roles } = project.access;
  const { root } = project.file;

  return Accounts.open({
    location: options.inMemory ?
      IN_MEMORY_LOCATION :
      path.join(root, STATE_DIRECTORY, kDatabaseFile),
    roles: options.defaultRole === undefined ?
      roles :
      new AccountRoles({
        roles,
        defaultRole: options.defaultRole
      }),
    cookie: new SessionCookie(cookieNameFor(root))
  });
}

function cookieNameFor(
  root: string
): string {
  const digest = createHash("sha256")
    .update(path.resolve(root))
    .digest("hex");

  return kCookiePrefix + digest.slice(0, 12);
}
