// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import type { Member } from "@jolly-pixel/accounts";
import {
  UNAUTHORIZED_CLOSE_CODE,
  type PeerMetadata
} from "@jolly-pixel/network";
import {
  Client,
  type ClientSocket,
  type ClientSocketEvent,
  type ClientSocketEventType
} from "@jolly-pixel/network/client";
import {
  DEFAULT_PROJECT_SECTIONS,
  ProjectRights
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  StudioSignedIn,
  type StudioAccountsClient
} from "../../src/accounts/StudioSignedIn.ts";
import { STUDIO_USER_CHANGE } from "../../src/accounts/StudioUser.ts";
import { StudioClients } from "../../src/api/StudioClients.ts";
import { AccountPreferences } from "../../src/preferences/AccountPreferences.ts";

// CONSTANTS
const kAlice: Member = {
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

interface ApiProbe {
  api: StudioClients;
  requests: string[];
  signIn(): void;
}

function accountApi(): ApiProbe {
  const requests: string[] = [];
  let signedIn = false;
  const replies: Record<string, unknown> = {
    "/api/preferences/": { scopes: {} },
    "/api/project/": {
      ...ProjectRights.NONE.toJSON(),
      share: true
    },
    "/api/project/sections": DEFAULT_PROJECT_SECTIONS
  };

  return {
    requests,
    signIn: () => {
      signedIn = true;
    },
    api: StudioClients.at("http://localhost/", async(input) => {
      const { pathname } = new URL(String(input));
      requests.push(pathname);

      return signedIn ?
        Response.json(replies[pathname]) :
        new Response(null, { status: 401 });
    })
  };
}

function idleConnect(
  profile: PeerMetadata
): Client {
  return new Client({
    profile,
    socket: () => new IdleSocket()
  });
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
      sections: DEFAULT_PROJECT_SECTIONS,
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

describe("StudioSignedIn.open", () => {
  const channels: BroadcastChannel[] = [];
  const NativeChannel = globalThis.BroadcastChannel;

  beforeEach(() => {
    globalThis.BroadcastChannel = class extends NativeChannel {
      constructor(name: string) {
        super(name);
        channels.push(this);
      }
    };
  });

  afterEach(() => {
    globalThis.BroadcastChannel = NativeChannel;
    for (const channel of channels.splice(0)) {
      channel.close();
    }
  });

  test("reads the account state while it checks the session", async() => {
    const { api, requests, signIn } = accountApi();
    signIn();
    const session = Promise.withResolvers<Member>();
    const opening = StudioSignedIn.open({
      accounts: {
        me: () => session.promise,
        replaceAvatar: async() => kAlice,
        logout: async() => undefined
      },
      signIn: async() => kAlice,
      api,
      connect: idleConnect,
      reload: () => undefined
    });
    await setImmediate();

    assert.equal(requests.length, 3);
    session.resolve(kAlice);
    const signedIn = await opening;

    assert.equal(requests.length, 3);
    assert.equal(signedIn.rights.allows("share"), true);
  });

  test("reads the account state again once the user signs in", async() => {
    const { api, signIn } = accountApi();

    const signedIn = await StudioSignedIn.open({
      accounts: {
        me: async() => null,
        replaceAvatar: async() => kAlice,
        logout: async() => undefined
      },
      signIn: async() => {
        signIn();

        return kAlice;
      },
      api,
      connect: idleConnect,
      reload: () => undefined
    });

    assert.equal(signedIn.rights.allows("share"), true);
  });
});
