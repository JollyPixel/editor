// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import { UNAUTHORIZED_CLOSE_CODE } from "@jolly-pixel/network";
import {
  Client,
  type ClientSocket,
  type ClientSocketEvent,
  type ClientSocketEventType
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  StudioSignedIn,
  type StudioAccountsClient
} from "../../src/accounts/StudioSignedIn.ts";
import { STUDIO_USER_CHANGE } from "../../src/accounts/StudioUser.ts";
import { StudioClients } from "../../src/api/StudioClients.ts";
import { AccountPreferences } from "../../src/preferences/AccountPreferences.ts";
import { ProjectRights } from "../../shared/ProjectRights.ts";

// CONSTANTS
const kAlice: Account = {
  id: "alice-id",
  username: "alice",
  role: "member",
  owner: false
};

class IdleSocket implements ClientSocket {
  readonly sent: string[] = [];
  #listeners = new Map<
    ClientSocketEventType,
    Array<(event: ClientSocketEvent) => void>
  >();

  send(
    data: string
  ): void {
    this.sent.push(data);
  }

  close(): void {
    this.emit("close", { code: 1000 });
  }

  addEventListener(
    type: ClientSocketEventType,
    listener: (event: ClientSocketEvent) => void
  ): void {
    this.#listeners.set(type, [
      ...this.#listeners.get(type) ?? [],
      listener
    ]);
  }

  emit(
    type: ClientSocketEventType,
    event: ClientSocketEvent
  ): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

interface SignedInProbe {
  signedIn: StudioSignedIn;
  sockets: IdleSocket[];
}

function signedInAs(
  accounts: Partial<StudioAccountsClient> = {}
): SignedInProbe {
  const sockets: IdleSocket[] = [];
  const api = StudioClients.at("http://localhost/");

  return {
    sockets,
    signedIn: new StudioSignedIn(kAlice, {
      accounts: {
        me: async() => kAlice,
        replaceAvatar: async() => kAlice,
        logout: async() => undefined,
        ...accounts
      },
      signIn: async() => kAlice,
      api,
      rights: ProjectRights.NONE,
      preferences: new AccountPreferences([], {
        accountId: kAlice.id,
        client: api.preferences,
        channel: null
      }),
      connect: (profile) => new Client({
        profile,
        socket: () => {
          const socket = new IdleSocket();
          sockets.push(socket);

          return socket;
        }
      }),
      reload: () => undefined
    })
  };
}

describe("StudioSignedIn", () => {
  test("renews a refused shell connection and reconnects it", async() => {
    const { sockets } = signedInAs();

    sockets[0]?.emit("close", { code: UNAUTHORIZED_CLOSE_CODE });
    await setImmediate();

    assert.equal(sockets.length, 2);
  });

  test("launches editors with the avatar it was given last", async() => {
    const { signedIn } = signedInAs({
      replaceAvatar: async() => {
        return {
          ...kAlice,
          avatar: "/api/accounts/avatars/alice-id?v=2"
        };
      }
    });
    let changes = 0;
    signedIn.addEventListener(STUDIO_USER_CHANGE, () => {
      changes++;
    });

    await signedIn.replaceAvatar(new Blob());

    assert.equal(signedIn.identity.avatar, "/api/accounts/avatars/alice-id?v=2");
    assert.equal(signedIn.identity.peerId, kAlice.id);
    assert.equal(changes, 1);
  });
});
