// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  Account,
  ShareLink
} from "@jolly-pixel/accounts";
import {
  Accounts,
  AccountRoles
} from "@jolly-pixel/accounts/node";
import { AssetKind } from "@jolly-pixel/asset";
import {
  WEBSOCKET_AUTH_PROTOCOL_PREFIX,
  WEBSOCKET_PROTOCOL,
  type AuthenticationRequest
} from "@jolly-pixel/network";
import type { ClientSocket } from "@jolly-pixel/network/client";
import type { Window } from "happy-dom";

// Import Internal Dependencies
import {
  SHARES_URL_PATH,
  createdShareReplySchema
} from "#src/shares/api.ts";
import { StudioAccess } from "#src/node/project/StudioAccess.ts";
import {
  StudioShares,
  type SharedCatalog
} from "#src/node/shares/StudioShares.ts";
import type { Browser } from "#src/testing.ts";

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
      project: {
        access: StudioAccess.read({ version: 1 }, "project.json")
      },
      catalog: sharedCatalog(closures)
    }),
    [Symbol.dispose]() {
      accounts[Symbol.dispose]();
    }
  };
}

export async function createShareLink(
  owner: Browser,
  url: URL,
  assetId: string
): Promise<ShareLink> {
  const response = await owner.fetch(new URL(`.${SHARES_URL_PATH}`, url), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      assetId,
      lifetime: "1d"
    })
  });
  assert.equal(response.status, 201);

  return createdShareReplySchema.parse(await response.json()).link;
}

export function sharedCatalog(
  closures: Record<string, string[]>
): SharedCatalog {
  return {
    record: (assetId) => (Object.hasOwn(closures, assetId) ?
      { kind: new AssetKind("voxelmap") } :
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
    headers: {},
    defaultRole: "spectator",
    credential: token
  };
}

export function guestProtocols(
  token: string
): string[] {
  return [
    WEBSOCKET_PROTOCOL,
    WEBSOCKET_AUTH_PROTOCOL_PREFIX + Buffer.from(token).toString("base64url")
  ];
}

export function guestSocket(
  page: Window,
  url: string,
  token: string
): ClientSocket {
  const socket = new page.WebSocket(url, guestProtocols(token));

  return {
    send: (data) => socket.send(data),
    close: () => socket.close(),
    addEventListener: (type, listener) => {
      socket.addEventListener(type, (event) => {
        listener({
          data: Reflect.get(event, "data"),
          code: Reflect.get(event, "code"),
          reason: Reflect.get(event, "reason")
        });
      });
    }
  };
}
