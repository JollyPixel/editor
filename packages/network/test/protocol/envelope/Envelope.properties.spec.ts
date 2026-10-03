// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import {
  Envelope,
  type Envelope as AnyEnvelope
} from "#src/protocol/envelope/Envelope.ts";
import {
  clientEnvelope,
  serverEnvelope
} from "../../helpers/arbitraries/envelopes.ts";
import {
  jsonPayload,
  wireCopy
} from "../../helpers/arbitraries/json.ts";

// CONSTANTS
const kEnvelopeKeys = [
  "room",
  "kind",
  "profile",
  "presence",
  "resume",
  "payload",
  "patch",
  "self",
  "rights",
  "members",
  "clientId",
  "role",
  "event",
  "reason"
];

function serialize(
  envelope: AnyEnvelope
): string {
  const result = Envelope.stringify(envelope);
  assert.ok(result.ok);

  return result.val;
}

const kExtraKey = fc.string({ minLength: 1, maxLength: 6 })
  .filter((key) => !kEnvelopeKeys.includes(key) && key !== "__proto__");

describe("Envelope properties", () => {
  test("a client envelope reads back as it was sent, minus prototype keys", () => {
    fc.assert(
      fc.property(clientEnvelope, (envelope) => {
        const parsed = Envelope.parseClient(serialize(envelope));

        assert.ok(parsed.ok);
        assert.deepStrictEqual(parsed.val, wireCopy(envelope));
      })
    );
  });

  test("a server envelope reads back as it was sent, minus prototype keys", () => {
    fc.assert(
      fc.property(serverEnvelope, (envelope) => {
        const parsed = Envelope.parseServer(serialize(envelope));

        assert.ok(parsed.ok);
        assert.deepStrictEqual(parsed.val, wireCopy(envelope));
      })
    );
  });

  test("only a message envelope travels in both directions", () => {
    fc.assert(
      fc.property(clientEnvelope, serverEnvelope, (client, server) => {
        const asServer = Envelope.parseServer(serialize(client));
        const asClient = Envelope.parseClient(serialize(server));

        assert.strictEqual(asServer.ok, client.kind === "message");
        assert.strictEqual(asClient.ok, server.kind === "message");
      })
    );
  });

  test("unknown properties do not stop an envelope from parsing", () => {
    fc.assert(
      fc.property(
        clientEnvelope,
        serverEnvelope,
        kExtraKey,
        jsonPayload,
        (client, server, key, extra) => {
          const parsedClient = Envelope.parseClient(serialize({ ...client, [key]: extra }));
          const parsedServer = Envelope.parseServer(serialize({ ...server, [key]: extra }));

          assert.ok(parsedClient.ok);
          assert.ok(parsedServer.ok);
          assert.strictEqual(parsedClient.val.kind, client.kind);
          assert.strictEqual(parsedServer.val.kind, server.kind);
        }
      )
    );
  });
});
