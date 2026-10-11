// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import {
  Accounts,
  AccountRoles
} from "@jolly-pixel/accounts/node";
import {
  WEBSOCKET_AUTH_PROTOCOL_PREFIX,
  WEBSOCKET_PROTOCOL,
  type AuthenticationRequest
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { StudioAccess } from "../../server/project/StudioAccess.ts";
import {
  StudioShares,
  type SharedCatalog
} from "../../server/shares/StudioShares.ts";

export interface ShareAccounts extends Disposable {
  accounts: Accounts;
  owner: Account;
  shares: StudioShares;
}

export async function shareAccounts(
  closures: Record<string, string[]>
): Promise<ShareAccounts> {
  const accounts = await Accounts.open({
    roles: new AccountRoles({
      roles: ["member", "spectator"],
      defaultRole: "member"
    })
  });
  const registration = await accounts.register({
    username: "Alice",
    password: "p".repeat(43)
  }, {
    address: "203.0.113.7",
    secure: false,
    headers: {}
  });
  assert.ok(registration.status === "active");

  return {
    accounts,
    owner: registration.account,
    shares: new StudioShares({
      accounts,
      access: StudioAccess.read({ version: 1 }, "project.json"),
      catalog: Promise.resolve(sharedCatalog(closures))
    }),
    [Symbol.dispose]() {
      accounts[Symbol.dispose]();
    }
  };
}

export function sharedCatalog(
  closures: Record<string, string[]>
): SharedCatalog {
  return {
    record: (assetId) => (Object.hasOwn(closures, assetId) ?
      { kind: "voxelmap" } :
      undefined),
    reachableFrom: (assetId) => new Set(closures[assetId] ?? [])
  };
}

export function guestUpgrade(
  token: string
): AuthenticationRequest {
  return {
    clientId: "guest",
    url: "/ws-sync",
    headers: {
      "sec-websocket-protocol": [
        WEBSOCKET_PROTOCOL,
        WEBSOCKET_AUTH_PROTOCOL_PREFIX + Buffer.from(token).toString("base64url")
      ].join(", ")
    },
    defaultRole: "spectator"
  };
}
