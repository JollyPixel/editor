// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PasswordAuthentication,
  RightsTable,
  Server,
  UnknownDefaultRoleError,
  type AuthenticationProvider,
  type ClientHandle
} from "#src/index.ts";
import { WEBSOCKET_AUTH_PROTOCOL_PREFIX } from "#src/transport/constants.ts";
import { PresenceOnlyExtension } from "#src/server/extension/PresenceOnlyExtension.ts";

function createClient(
  id: string
): { client: ClientHandle; sent: unknown[]; } {
  const sent: unknown[] = [];

  return {
    client: {
      id,
      send: (data) => sent.push(data)
    },
    sent
  };
}

function attempt(
  clientId: string,
  credential?: string
): Parameters<Server["authenticate"]>[0] {
  return {
    clientId,
    url: "/ws-sync",
    headers: credential === undefined ?
      {} :
      {
        "sec-websocket-protocol":
          `jolly-pixel, ${WEBSOCKET_AUTH_PROTOCOL_PREFIX}` +
          Buffer.from(credential, "utf8").toString("base64url")
      }
  };
}

describe("Server — defaultRole", () => {
  test("defaults to \"default\" when neither rights nor defaultRole is given", async() => {
    await using server = new Server();

    assert.deepEqual(await server.authenticate(attempt("A")), {
      subject: "A",
      role: "default"
    });
  });

  test("mints the configured default role for an unauthenticated client", async() => {
    await using server = new Server({
      rights: { viewer: { "presence.*": "read" } },
      defaultRole: "viewer"
    });

    assert.deepEqual(await server.authenticate(attempt("A")), {
      subject: "A",
      role: "viewer"
    });
  });

  test("throws when defaultRole names a role absent from the rights table", () => {
    assert.throws(
      () => new Server({
        rights: { viewer: { "presence.*": "read" } },
        defaultRole: "editor"
      }),
      UnknownDefaultRoleError
    );
  });

  test("accepts a defaultRole when no rights table constrains the vocabulary", () => {
    assert.strictEqual(
      new RightsTable(undefined, "anything").defaultRole,
      "anything"
    );
  });
});

describe("Server — authenticate", () => {
  test("elevates a client offering the right password", async() => {
    await using server = new Server({
      rights: {
        viewer: { "presence.*": "read" },
        editor: { "presence.*": "write" }
      },
      defaultRole: "viewer",
      auth: new PasswordAuthentication({
        password: "hunter2",
        role: "editor"
      })
    });

    assert.deepEqual(await server.authenticate(attempt("A", "hunter2")), {
      subject: "A",
      role: "editor"
    });
    assert.deepEqual(await server.authenticate(attempt("B")), {
      subject: "B",
      role: "viewer"
    });
    assert.strictEqual(await server.authenticate(attempt("C", "wrong")), null);
  });

  test("awaits an asynchronous provider", async() => {
    const auth: AuthenticationProvider = {
      authenticate: (request) => Promise.resolve({
        subject: `user:${request.clientId}`,
        role: request.defaultRole
      })
    };
    await using server = new Server({ auth });

    assert.deepEqual(await server.authenticate(attempt("A")), {
      subject: "user:A",
      role: "default"
    });
  });
});

describe("Server — the authenticated role drives rights", () => {
  test("a room reports the authenticated client's rights in its sync envelope", async() => {
    await using server = new Server({
      rights: {
        viewer: { "presence.$presence": "read" },
        editor: { "presence.$presence": "write" }
      },
      defaultRole: "viewer"
    });
    server.register(new PresenceOnlyExtension("lobby", "presence"));

    const { client, sent } = createClient("A");
    server.handleConnect(client, { subject: "A", role: "editor" });
    await server.handleMessage("A", { room: "lobby", kind: "join" });

    assert.deepEqual(sent, [{
      room: "lobby",
      kind: "sync",
      self: "A",
      rights: { $presence: "write" },
      members: [
        {
          clientId: "A",
          role: "editor",
          profile: Object.create(null),
          presence: {}
        }
      ]
    }]);
  });

  test("the join envelope cannot raise the connection's role", async() => {
    await using server = new Server({
      rights: { viewer: { "presence.$join": "void" } },
      defaultRole: "viewer"
    });
    server.register(new PresenceOnlyExtension("lobby", "presence"));

    const { client, sent } = createClient("A");
    server.handleConnect(client, { subject: "A", role: "viewer" });
    await server.handleMessage("A", {
      room: "lobby",
      kind: "join",
      profile: { role: "admin" }
    });

    assert.deepEqual(sent, [{
      room: "lobby",
      kind: "denied",
      event: "$join",
      reason: "role \"viewer\" is not permitted to join this room"
    }]);
  });
});
