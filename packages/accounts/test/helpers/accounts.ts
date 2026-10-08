// Import Node.js Dependencies
import { DatabaseSync } from "node:sqlite";

// Import Third-party Dependencies
import type { PasswordHash } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import { Username } from "#src/account/Username.ts";
import {
  Accounts,
  AccountStore,
  AccountRoles,
  type AccountsOptions,
  type AccountStoreOptions
} from "#src/node.ts";

// CONSTANTS
export const FIXED_HASH: PasswordHash = {
  digest: Buffer.alloc(32, 1),
  salt: Buffer.alloc(16, 2)
};
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

export function createStore(
  options: AccountStoreOptions = {}
): AccountStore {
  return new AccountStore(
    new DatabaseSync(":memory:"),
    options
  );
}

export function createAccounts(
  store: AccountStore = createStore(),
  options: Omit<AccountsOptions, "store" | "roles"> = {}
): Accounts {
  return new Accounts({
    store,
    roles: ROLES,
    ...options
  });
}

export function storeWith(
  ...usernames: string[]
): AccountStore {
  const store = createStore();
  for (const username of usernames) {
    store.register(name(username), FIXED_HASH, ROLES.defaultRole);
  }

  return store;
}
