// Import Node.js Dependencies
import { createHash } from "node:crypto";
import path from "node:path";

// Import Third-party Dependencies
import { STATE_DIRECTORY } from "@jolly-pixel/asset-source";
import {
  Accounts,
  IN_MEMORY_LOCATION,
  SessionCookie,
  type AccountsRealm,
  type AccountsThrottleOptions
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import {
  AccountsAccess,
  type AccountsPolicy
} from "./AccountsAccess.ts";
import type { StudioProject } from "../../project/node/StudioProject.ts";
import { MASTER_PASSWORD_ENV } from "../../server/node/StudioServerSettings.ts";

// CONSTANTS
const kDatabaseFile = "accounts.db";
const kCookiePrefix = "jolly_session_";
export const ACCOUNTS_STATE_IGNORES = [
  kDatabaseFile,
  `${kDatabaseFile}-journal`,
  `${kDatabaseFile}-wal`,
  `${kDatabaseFile}-shm`
];

export interface StudioAccountsOptions extends AccountsPolicy {
  /**
   * Keeps accounts in memory instead of the project state directory.
   * @default false
   */
  inMemory?: boolean;
  throttle?: AccountsThrottleOptions;
  /**
   * Secret the first account gives to register. Without it, anyone who
   * reaches the server first owns it.
   */
  masterPassword?: string;
  /**
   * Warned when no master password is set and registration is open.
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
  const masterPassword = options.masterPassword === "" ?
    undefined :
    options.masterPassword;
  if (masterPassword === undefined) {
    options.logger?.warn(
      `${MASTER_PASSWORD_ENV} is not set: anyone who reaches this server ` +
      "can register, and the first account owns it"
    );
  }

  return Accounts.open({
    location: options.inMemory ?
      IN_MEMORY_LOCATION :
      path.join(root, STATE_DIRECTORY, kDatabaseFile),
    cookie: new SessionCookie({
      name: hashCookieName(root)
    }),
    throttle: options.throttle,
    masterPassword
  });
}

export function openProjectRealm(
  accounts: Accounts,
  project: StudioProject,
  policy: AccountsPolicy = {}
): AccountsRealm {
  return AccountsAccess
    .resolve(project.access, policy)
    .openRealm(accounts, path.resolve(project.file.root));
}

function hashCookieName(
  root: string
): string {
  const digest = createHash("sha256")
    .update(path.resolve(root))
    .digest("hex");

  return kCookiePrefix + digest.slice(0, 12);
}
