// Import Node.js Dependencies
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

// Import Third-party Dependencies
import type { PasswordHash } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import type { Account } from "#src/account/Account.ts";
import { AccountEntity } from "#src/account/AccountEntity.ts";
import { Username } from "#src/account/Username.ts";
import {
  AccountDirectory,
  type AccountDirectoryOptions,
  type Registration
} from "#src/AccountDirectory.ts";
import type { RegistrationResult } from "#src/registration/RegistrationResult.ts";
import { PasswordDigest } from "#src/session/PasswordDigest.ts";
import { SessionToken } from "#src/session/SessionToken.ts";
import { SqliteDatabase } from "#src/store/SqliteDatabase.ts";
import {
  Accounts,
  AccountsDatabase,
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

export function createDatabase(): AccountsDatabase {
  return new AccountsDatabase(
    new SqliteDatabase(
      new DatabaseSync(":memory:")
    )
  );
}

export function insertAccount(
  database: AccountsDatabase,
  account: AccountEntity
): AccountEntity {
  database.accounts.insert(
    account,
    name(account.username),
    FIXED_HASH
  );

  return account;
}

export function databaseWith(
  ...usernames: string[]
): AccountsDatabase {
  const database = createDatabase();
  for (const username of usernames) {
    insertAccount(
      database,
      database.accounts.size === 0 ?
        AccountEntity.claim(name(username)) :
        AccountEntity.register(name(username), ROLES.defaultRole)
    );
  }

  return database;
}

export function requestAccess(
  database: AccountsDatabase,
  username: string
): AccountEntity {
  return insertAccount(
    database,
    AccountEntity.request(name(username), ROLES.defaultRole)
  );
}

export function databaseWithRetiredRole(): AccountsDatabase {
  const database = databaseWith("Alice");
  insertAccount(
    database,
    AccountEntity.register(name("Bob"), "editor")
  );

  return database;
}

export function createDirectory(
  database: AccountsDatabase = createDatabase(),
  options: Omit<AccountDirectoryOptions, "database" | "roles"> = {}
): AccountDirectory {
  return new AccountDirectory({
    database,
    roles: ROLES,
    ...options
  });
}

export function createAccounts(
  database: AccountsDatabase = createDatabase(),
  options: Omit<AccountsOptions, "database" | "roles"> = {}
): Accounts {
  return new Accounts({
    database,
    roles: ROLES,
    ...options
  });
}

export function sessionFor(
  database: AccountsDatabase,
  accountId: string
): string {
  const token = SessionToken.mint();
  database.sessions.open(token, accountId, Date.now() + DEFAULT_SESSION_TTL_MS);

  return token.value;
}
