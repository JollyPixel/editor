// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setTimeout as nextTimer } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createClient } from "../../helpers/server/clientHandle.ts";
import { RecordingExtension } from "../../helpers/server/RecordingExtension.ts";
import {
  PresenceOnlyExtension,
  Server,
  UnknownDefaultRoleError,
  type AuthenticationProvider,
  type ClientHandle
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

  test("accepts a defaultRole when no rights table constrains the vocabulary", async() => {
    await using server = new Server({ defaultRole: "anything" });

    assert.deepEqual(await server.authenticate(attempt("A")), {
      subject: "A",
      role: "anything"
    });
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
        editor: {
          "presence.$join": "write",
          "presence.$presence": "write"
        }
      },
      defaultRole: "viewer"
    });
    server.register(new PresenceOnlyExtension("lobby", "presence"));

    const { client, sent } = createClient("A");
    const connectionA = server.connect(client, { subject: "A", role: "editor" });
    await connectionA.receive({ room: "lobby", kind: "join" });

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
    const connectionA = server.connect(client, { subject: "A", role: "viewer" });
    await connectionA.receive({
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

describe("Server — revocations", () => {
  function closableClient(
    id: string,
    closed: string[]
  ): ClientHandle {
    return {
      id,
      send: () => void 0,
      close: (code) => closed.push(`${id}:${code}`)
    };
  }

  test("a provider's revocation closes every connection of that subject only with 4001", async() => {
    const revoked = new Set<(subject: string) => void>();
    const auth: AuthenticationProvider = {
      authenticate: () => null,
      watchRevocations(listener) {
        revoked.add(listener);

        return () => revoked.delete(listener);
      }
    };
    const closed: string[] = [];
    await using server = new Server({ auth });
    server.connect(closableClient("A1", closed), { subject: "alice", role: "default" });
    server.connect(closableClient("A2", closed), { subject: "alice", role: "default" });
    server.connect(closableClient("B", closed), { subject: "bob", role: "default" });

    for (const listener of revoked) {
      listener("alice");
    }
    await nextTimer(0);

    assert.deepEqual(closed, ["A1:4001", "A2:4001"]);
  });

  test("drops the envelopes a revoked connection sends before it closes", async() => {
    await using server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);
    const connectionA = server.connect(
      closableClient("A", []),
      {
        subject: "alice",
        role: "default"
      }
    );
    await connectionA.receive({ room: "pixel-draw", kind: "join" });

    server.revoke("alice");
    await connectionA.receive({
      room: "pixel-draw",
      kind: "message",
      payload: {}
    });

    assert.deepEqual(extension.messages, []);
  });
});
