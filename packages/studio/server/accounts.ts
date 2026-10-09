// Import Node.js Dependencies
import { createHash } from "node:crypto";
import path from "node:path";

// Import Third-party Dependencies
import { STATE_DIRECTORY } from "@jolly-pixel/asset-source";
import {
  Accounts,
  AccountRoles,
  IN_MEMORY_LOCATION,
  SessionCookie,
  type AccountsThrottleOptions,
  type MasterPasswordOptions
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import type { StudioProject } from "./StudioProject.ts";

// CONSTANTS
const kDatabaseFile = "accounts.db";
const kCookiePrefix = "jolly_session_";
const kMasterPasswordEnv = "JOLLY_MASTER_PASSWORD";
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
}

export async function openStudioAccounts(
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
    cookie: new SessionCookie(cookieNameFor(root)),
    throttle: options.throttle,
    masterPassword: masterPasswordFor(project, options.env ?? {})
  });
}

function masterPasswordFor(
  project: StudioProject,
  env: Record<string, string | undefined>
): MasterPasswordOptions | undefined {
  const secret = env[kMasterPasswordEnv];
  const required = project.access.masterPasswordRequired;
  if (secret === undefined || secret === "") {
    if (required) {
      throw new Error(
        `"${project.file.path}" sets masterPasswordRequired but ${kMasterPasswordEnv} is not set`
      );
    }

    return undefined;
  }

  return {
    secret,
    required
  };
}

function cookieNameFor(
  root: string
): string {
  const digest = createHash("sha256")
    .update(path.resolve(root))
    .digest("hex");

  return kCookiePrefix + digest.slice(0, 12);
}
