// Import Node.js Dependencies
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
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
import type { Project } from "../../project/node/Project.ts";
import { MASTER_PASSWORD_ENV } from "../../server/node/ServerSettings.ts";

// CONSTANTS
const kDatabaseFile = "accounts.db";
const kCookiePrefix = "jolly_session_";
export const ACCOUNTS_STATE_IGNORES = [
  kDatabaseFile,
  `${kDatabaseFile}-journal`,
  `${kDatabaseFile}-wal`,
  `${kDatabaseFile}-shm`
];

export interface ServerAccountsOptions {
  /**
   * Keeps accounts in memory instead of the server state folder.
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
  logger?: ServerAccountsLogger;
}

export interface ServerAccountsLogger {
  warn(message: string): void;
}

export async function openServerAccounts(
  state: string,
  options: ServerAccountsOptions = {}
): Promise<Accounts> {
  const masterPassword = options.masterPassword === "" ?
    undefined :
    options.masterPassword;
  if (masterPassword === undefined) {
    options.logger?.warn(
      `${MASTER_PASSWORD_ENV} is not set: anyone who reaches this server ` +
      "can register, and the first account owns it"
    );
  }

  if (options.inMemory !== true) {
    await fs.mkdir(state, { recursive: true });
  }

  return Accounts.open({
    location: options.inMemory ?
      IN_MEMORY_LOCATION :
      path.join(state, kDatabaseFile),
    cookie: new SessionCookie({
      name: hashCookieName(state)
    }),
    throttle: options.throttle,
    masterPassword
  });
}

export function openProjectRealm(
  accounts: Accounts,
  project: Project,
  policy: AccountsPolicy = {}
): AccountsRealm {
  return AccountsAccess
    .resolve(project.access, policy)
    .openRealm(accounts, project.id);
}

function hashCookieName(
  state: string
): string {
  const digest = createHash("sha256")
    .update(path.resolve(state))
    .digest("hex");

  return kCookiePrefix + digest.slice(0, 12);
}
