// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Result } from "@openally/result";

// Import Internal Dependencies
import {
  describeEnvelopeParseError,
  Envelope,
  type EnvelopeParseError
} from "#src/protocol/envelope/Envelope.ts";

function unwrapError(
  result: Result<unknown, EnvelopeParseError>
): EnvelopeParseError {
  assert.ok(!result.ok);

  return result.val;
}

describe("Envelope.parseClient", () => {
  test("accepts an already-deserialized object", () => {
    const result = Envelope.parseClient({
      room: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.val, {
      room: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    });
  });

  test("rejects a presence envelope without a patch", () => {
    const result = Envelope.parseClient({ room: "pixel-draw", kind: "presence" });

    assert.equal(unwrapError(result).reason, "malformed");
  });

  test("rejects a message envelope without a payload", () => {
    const result = Envelope.parseClient({ room: "pixel-draw", kind: "message" });

    assert.equal(unwrapError(result).reason, "malformed");
  });

  test("rejects a profile that is not an object", () => {
    const result = Envelope.parseClient({
      room: "pixel-draw",
      kind: "join",
      profile: "anonymous"
    });

    assert.equal(unwrapError(result).reason, "malformed");
  });

  test("reports invalid JSON apart from a malformed shape", () => {
    const result = Envelope.parseClient("{not json");

    assert.equal(unwrapError(result).reason, "invalid-json");
    assert.match(describeEnvelopeParseError(unwrapError(result)), /invalid JSON/);
  });

  test("rejects a value that is not an envelope shape", () => {
    for (const value of [null, 42, { hello: "world" }, { kind: "leave" }, { room: 42, kind: "leave" }]) {
      const result = Envelope.parseClient(value);

      assert.equal(result.ok, false, `expected ${JSON.stringify(value)} to be rejected`);
    }
  });

  test("rejects a room name longer than 256 characters", () => {
    assert.equal(Envelope.parseClient({ room: "r".repeat(256), kind: "leave" }).ok, true);
    assert.equal(
      unwrapError(Envelope.parseClient({ room: "r".repeat(257), kind: "leave" })).reason,
      "malformed"
    );
  });

  test("rejects an unrecognized kind", () => {
    const result = Envelope.parseClient({ room: "pixel-draw", kind: "unknown-kind" });

    assert.equal(unwrapError(result).reason, "malformed");
    assert.notEqual(describeEnvelopeParseError(unwrapError(result)), "");
  });
});

describe("Envelope.parseServer", () => {
  test("rejects a sync envelope without members", () => {
    const result = Envelope.parseServer({
      room: "pixel-draw",
      kind: "sync",
      self: "a",
      rights: {}
    });

    assert.equal(unwrapError(result).reason, "malformed");
  });

  test("rejects a sync envelope whose rights are not a known right", () => {
    const result = Envelope.parseServer({
      room: "pixel-draw",
      kind: "sync",
      self: "a",
      rights: { "voxel-set": "admin" },
      members: []
    });

    assert.equal(unwrapError(result).reason, "malformed");
  });

  test("rejects a sync envelope whose members are not peers", () => {
    const result = Envelope.parseServer({
      room: "pixel-draw",
      kind: "sync",
      self: "a",
      rights: {},
      members: [
        {
          clientId: 42,
          role: "default",
          profile: {},
          presence: {}
        }
      ]
    });

    assert.equal(unwrapError(result).reason, "malformed");
  });

  test("rejects a peer-joined envelope with a non-string clientId", () => {
    const result = Envelope.parseServer({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: 42,
      role: "default",
      profile: {},
      presence: {}
    });

    assert.equal(unwrapError(result).reason, "malformed");
  });
});

describe("Envelope.parseTrustedServer", () => {
  test("checks only the room and kind of a server envelope", () => {
    const result = Envelope.parseTrustedServer(JSON.stringify({
      room: "pixel-draw",
      kind: "sync",
      self: "A"
    }));

    assert.equal(result.ok, true);
    assert.equal(unwrapError(Envelope.parseServer({
      room: "pixel-draw",
      kind: "sync",
      self: "A"
    })).reason, "malformed");
  });

  test("rejects invalid JSON, a missing room and an unknown kind", () => {
    assert.equal(unwrapError(Envelope.parseTrustedServer("{")).reason, "invalid-json");
    for (const value of [
      null,
      { kind: "message" },
      { room: "pixel-draw", kind: "join" }
    ]) {
      assert.equal(
        unwrapError(Envelope.parseTrustedServer(value)).reason,
        "malformed",
        `expected ${JSON.stringify(value)} to be rejected`
      );
    }
  });
});

describe("Envelope.stringify", () => {
  test("fails with a descriptive error for a value JSON.stringify can't serialize", () => {
    const circular: Record<string, unknown> = { hello: "world" };
    circular.self = circular;

    const result = Envelope.stringify({
      room: "pixel-draw",
      kind: "message",
      payload: circular
    });

    assert.ok(!result.ok);
    assert.match(result.val, /circular/i);
  });
});
