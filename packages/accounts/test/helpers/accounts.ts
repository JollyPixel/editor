// Import Node.js Dependencies
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

// Import Third-party Dependencies
import type { PasswordHash } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import type { Member } from "#src/account/Account.ts";
import type { AgentToken } from "#src/agent/AgentToken.ts";
import type { ShareLink } from "#src/share/ShareLink.ts";
import { AccountEntity } from "#src/account/AccountEntity.ts";
import { Username } from "#src/account/Username.ts";
import {
  AccountDirectory,
  type AccountDirectoryOptions
} from "#src/AccountDirectory.ts";
import {
  MemberDirectory,
  type MemberDirectoryOptions,
  type Registration
} from "#src/realm/MemberDirectory.ts";
import { Membership } from "#src/realm/Membership.ts";
import type { RegistrationResult } from "#src/registration/RegistrationResult.ts";
import { PasswordDigest } from "#src/session/PasswordDigest.ts";
import { SessionToken } from "#src/session/SessionToken.ts";
import { SqliteDatabase } from "#src/store/SqliteDatabase.ts";
import {
  Accounts,
  AccountsDatabase,
  AccountRoles,
  DEFAULT_SESSION_TTL_MS,
  type AccountsOptions,
  type AccountsRealm,
  type AccountsRealmOptions
} from "#src/node.ts";

// CONSTANTS
export const REALM = "project";
export const OTHER_REALM = "other-project";
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

export type MembersOptions =
  Omit<AccountDirectoryOptions, "database"> &
  Omit<MemberDirectoryOptions, "accounts" | "roles" | "realmId"> &
  { realmId?: string; };

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
): Promise<Member> {
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

export function addMembership(
  database: AccountsDatabase,
  membership: Membership
): Membership {
  database.memberships.save(membership);

  return membership;
}

export function databaseWith(
  ...usernames: string[]
): AccountsDatabase {
  const database = createDatabase();
  for (const username of usernames) {
    if (database.accounts.size === 0) {
      insertAccount(database, AccountEntity.claim(name(username)));
      continue;
    }
    const account = insertAccount(
      database,
      AccountEntity.register(name(username))
    );
    addMembership(
      database,
      Membership.active(REALM, account.id, ROLES.defaultRole)
    );
  }

  return database;
}

export function requestAccess(
  database: AccountsDatabase,
  username: string
): AccountEntity {
  const account = insertAccount(
    database,
    AccountEntity.register(name(username))
  );
  addMembership(
    database,
    Membership.request(REALM, account.id, ROLES.defaultRole)
  );

  return account;
}

export function databaseWithRetiredRole(): AccountsDatabase {
  const database = databaseWith("Alice");
  const bob = insertAccount(
    database,
    AccountEntity.register(name("Bob"))
  );
  addMembership(database, Membership.active(REALM, bob.id, "editor"));

  return database;
}

export function createDirectory(
  database: AccountsDatabase = createDatabase(),
  options: Omit<AccountDirectoryOptions, "database"> = {}
): AccountDirectory {
  return new AccountDirectory({
    database,
    ...options
  });
}

export function createMembers(
  database: AccountsDatabase = createDatabase(),
  options: MembersOptions = {}
): MemberDirectory {
  const {
    realmId = REALM,
    join,
    maxRequests,
    ...directoryOptions
  } = options;

  return new MemberDirectory({
    realmId,
    accounts: createDirectory(database, directoryOptions),
    roles: ROLES,
    join,
    maxRequests
  });
}

export function createAccounts(
  database: AccountsDatabase = createDatabase(),
  options: Omit<AccountsOptions, "database"> = {}
): Accounts {
  return new Accounts({
    database,
    ...options
  });
}

export function createRealm(
  accounts: Accounts,
  options: Partial<AccountsRealmOptions> = {},
  realmId = REALM
): AccountsRealm {
  return accounts.realm(realmId, {
    roles: ROLES,
    ...options
  });
}

export function insertAgentToken(
  database: AccountsDatabase,
  ownerId: string,
  realmId = REALM
): AgentToken {
  const token: AgentToken = {
    id: `agent-of-${ownerId}-in-${realmId}`,
    ownerId,
    name: "Golem",
    createdAt: 0
  };
  database.agentTokens.insert(realmId, token, SessionToken.mint());

  return token;
}

export function insertShareLink(
  database: AccountsDatabase,
  realmId: string,
  createdBy: string
): ShareLink {
  const link: ShareLink = {
    id: `link-of-${createdBy}-in-${realmId}`,
    token: SessionToken.mint().value,
    assetId: "asset-a",
    createdBy,
    createdAt: 0,
    expiresAt: null
  };
  database.shareLinks.insert(realmId, link);

  return link;
}

export function openSession(
  database: AccountsDatabase,
  accountId: string
): string {
  const token = SessionToken.mint();
  database.sessions.open(token, accountId, Date.now() + DEFAULT_SESSION_TTL_MS);

  return token.value;
}
