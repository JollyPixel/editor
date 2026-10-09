// Import Node.js Dependencies
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

// Import Third-party Dependencies
import type { PasswordHash } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import type { Account } from "#src/account/Account.ts";
import { Username } from "#src/account/Username.ts";
import {
  AccountDirectory,
  type AccountDirectoryOptions,
  type Registration
} from "#src/AccountDirectory.ts";
import {
  ACCOUNTS_URL_PATH,
  avatarPath
} from "#src/http/accounts/routes.ts";
import type { RegistrationResult } from "#src/registration/RegistrationResult.ts";
import { PasswordDigest } from "#src/session/PasswordDigest.ts";
import { SessionToken } from "#src/session/SessionToken.ts";
import { SqliteDatabase } from "#src/store/SqliteDatabase.ts";
import {
  Accounts,
  AccountStore,
  AccountRoles,
  DEFAULT_SESSION_TTL_MS,
  type AccountsOptions
} from "#src/node.ts";

// CONSTANTS
export const FIXED_HASH: PasswordHash = {
  digest: Buffer.alloc(32, 1),
  salt: Buffer.alloc(16, 2)
};
export const PASSWORD = PasswordDigest.parse("p".repeat(43));
export const WRONG_PASSWORD = PasswordDigest.parse("w".repeat(43));
export const ADDRESS = "203.0.113.7";
export const ROLES = new AccountRoles({
  roles: [
    "member",
    "spectator"
  ],
  defaultRole: "spectator"
});

export function name(
  value: string
): Username {
  return Username.parse(value);
}

export function registration(
  username: string,
  masterPassword?: string
): Registration {
  return {
    username: name(username),
    password: PASSWORD,
    options: {
      masterPassword
    }
  };
}

export async function activeAccount(
  registering: Promise<RegistrationResult>
): Promise<Account> {
  const result = await registering;
  assert.ok(result.status === "active");

  return result.account;
}

export function createStore(
  roles: AccountRoles = ROLES
): AccountStore {
  return new AccountStore(
    new SqliteDatabase(
      new DatabaseSync(":memory:")
    ),
    roles
  );
}

export function storeWith(
  ...usernames: string[]
): AccountStore {
  const store = createStore();
  for (const username of usernames) {
    store.register(name(username), FIXED_HASH);
  }

  return store;
}

export function storeWithRetiredRole(): AccountStore {
  const db = new SqliteDatabase(
    new DatabaseSync(":memory:")
  );
  const before = new AccountStore(db, new AccountRoles({
    roles: [
      "editor",
      "spectator"
    ],
    defaultRole: "spectator"
  }));
  const alice = before.register(name("Alice"), FIXED_HASH);
  before.register(name("Bob"), FIXED_HASH);
  before.assignRole(alice.id, name("bob"), "editor");

  return new AccountStore(db, ROLES);
}

export function createDirectory(
  store: AccountStore = createStore(),
  options: Omit<AccountDirectoryOptions, "store" | "avatarUrl"> = {}
): AccountDirectory {
  return new AccountDirectory({
    store,
    avatarUrl: (accountId, hash) => avatarPath(ACCOUNTS_URL_PATH, accountId, hash),
    ...options
  });
}

export function createAccounts(
  store: AccountStore = createStore(),
  options: Omit<AccountsOptions, "store"> = {}
): Accounts {
  return new Accounts({
    store,
    ...options
  });
}

export function sessionFor(
  store: AccountStore,
  accountId: string
): string {
  const token = SessionToken.mint();
  store.openSession(token, accountId, Date.now() + DEFAULT_SESSION_TTL_MS);

  return token.value;
}
