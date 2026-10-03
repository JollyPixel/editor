// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createClient } from "../../helpers/server/clientHandle.ts";
import {
  PresenceOnlyExtension,
  RightsTable,
  Server,
  UnknownDefaultRoleError,
  type AuthenticationProvider
} from "#src/index.ts";

function attempt(
  clientId: string
): Parameters<Server["authenticate"]>[0] {
  return {
    clientId,
    url: "/ws-sync",
    headers: {}
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

  test("refuses the client when the provider throws or rejects", async() => {
    const providers: AuthenticationProvider[] = [
      {
        authenticate: () => {
          throw new Error("provider down");
        }
      },
      {
        authenticate: () => Promise.reject(new Error("provider down"))
      }
    ];

    for (const auth of providers) {
      await using server = new Server({ auth });

      assert.strictEqual(await server.authenticate(attempt("A")), null);
    }
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
      rights: {
        viewer: { "presence.$join": "void" },
        admin: { "presence.$join": "write" }
      },
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
