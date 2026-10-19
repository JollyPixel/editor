// Import Node.js Dependencies
import { createHash } from "node:crypto";
import path from "node:path";

// Import Third-party Dependencies
import { STATE_DIRECTORY } from "@jolly-pixel/asset-source";
import {
  Accounts,
  IN_MEMORY_LOCATION,
  SessionCookie,
  type AccountsThrottleOptions
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import {
  AccountsAccess,
  MASTER_PASSWORD_ENV
} from "./AccountsAccess.ts";
import type { StudioProject } from "./project/StudioProject.ts";

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
  throttle?: AccountsThrottleOptions;
  /**
   * Environment to read `JOLLY_MASTER_PASSWORD` from.
   * @default {}
   */
  env?: Record<string, string | undefined>;
  /**
   * Warned when `JOLLY_MASTER_PASSWORD` is not set and registration is open.
   */
  logger?: StudioAccountsLogger;
}

export interface StudioAccountsLogger {
  warn(message: string): void;
}

export async function openStudioAccounts(
  project: StudioProject,
  options: StudioAccountsOptions = {}
): Promise<Accounts> {
  const { root } = project.file;
  const access = AccountsAccess.resolve(
    project.access,
    options,
    project.file.path
  );
  if (access.masterPassword === undefined) {
    options.logger?.warn(
      `${MASTER_PASSWORD_ENV} is not set: anyone who reaches this server ` +
      "can register, and the first account becomes admin"
    );
  }

  return Accounts.open({
    location: options.inMemory ?
      IN_MEMORY_LOCATION :
      path.join(root, STATE_DIRECTORY, kDatabaseFile),
    roles: access.roles,
    cookie: new SessionCookie({
      name: hashCookieName(root)
    }),
    throttle: options.throttle,
    masterPassword: access.masterPassword
  });
}

function hashCookieName(
  root: string
): string {
  const digest = createHash("sha256")
    .update(path.resolve(root))
    .digest("hex");

  return kCookiePrefix + digest.slice(0, 12);
}
