// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  describeEnvelopeParseError,
  Envelope,
  type ClientEnvelope,
  type EnvelopeParseError
} from "#src/protocol/Envelope.ts";

function errorOf(
  result: { ok: boolean; val: unknown; }
): EnvelopeParseError {
  assert.equal(result.ok, false);

  return result.val as EnvelopeParseError;
}

describe("Envelope.parseClient", () => {
  test("parses a valid JSON string into a client envelope", () => {
    const result = Envelope.parseClient(
      JSON.stringify({ room: "pixel-draw", kind: "leave" })
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.val, { room: "pixel-draw", kind: "leave" });
  });

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

  test("accepts a join envelope without identity", () => {
    const result = Envelope.parseClient({ room: "pixel-draw", kind: "join" });

    assert.equal(result.ok, true);
  });

  test("rejects a server-only kind", () => {
    for (const kind of ["sync", "peer-joined", "peer-left", "denied", "error"]) {
      const result = Envelope.parseClient({ room: "pixel-draw", kind });

      assert.equal(result.ok, false, `expected "${kind}" to be rejected`);
      assert.equal(errorOf(result).reason, "malformed");
    }
  });

  test("rejects a presence envelope without a patch", () => {
    const result = Envelope.parseClient({ room: "pixel-draw", kind: "presence" });

    assert.equal(errorOf(result).reason, "malformed");
  });

  test("rejects a message envelope without a payload", () => {
    const result = Envelope.parseClient({ room: "pixel-draw", kind: "message" });

    assert.equal(errorOf(result).reason, "malformed");
  });

  test("rejects a profile that is not an object", () => {
    const result = Envelope.parseClient({
      room: "pixel-draw",
      kind: "join",
      profile: "anonymous"
    });

    assert.equal(errorOf(result).reason, "malformed");
  });

  test("reports invalid JSON apart from a malformed shape", () => {
    const result = Envelope.parseClient("{not json");

    assert.equal(errorOf(result).reason, "invalid-json");
    assert.match(describeEnvelopeParseError(errorOf(result)), /invalid JSON/);
  });

  test("rejects a value that is not an envelope shape", () => {
    for (const value of [null, 42, { hello: "world" }, { kind: "leave" }, { room: 42, kind: "leave" }]) {
      const result = Envelope.parseClient(value);

      assert.equal(result.ok, false, `expected ${JSON.stringify(value)} to be rejected`);
    }
  });

  test("rejects an unrecognized kind", () => {
    const result = Envelope.parseClient({ room: "pixel-draw", kind: "unknown-kind" });

    assert.equal(errorOf(result).reason, "malformed");
    assert.notEqual(describeEnvelopeParseError(errorOf(result)), "");
  });
});

describe("Envelope.parseServer", () => {
  test("accepts a denied envelope", () => {
    const result = Envelope.parseServer({
      room: "pixel-draw",
      kind: "denied",
      event: "$join",
      reason: "role \"viewer\" is not permitted to join this room"
    });

    assert.equal(result.ok, true);
  });

  test("accepts an error envelope", () => {
    const result = Envelope.parseServer({
      room: "pixel-draw",
      kind: "error",
      event: "pixel-set",
      reason: "disk full"
    });

    assert.equal(result.ok, true);
  });

  test("accepts a sync envelope carrying self, rights and members", () => {
    const result = Envelope.parseServer({
      room: "pixel-draw",
      kind: "sync",
      self: "a",
      rights: { "voxel-set": "read" },
      members: [
        {
          clientId: "a",
          role: "viewer",
          profile: { name: "ada" },
          presence: {}
        }
      ]
    });

    assert.equal(result.ok, true);
  });

  test("rejects a sync envelope without members", () => {
    const result = Envelope.parseServer({
      room: "pixel-draw",
      kind: "sync",
      self: "a",
      rights: {}
    });

    assert.equal(errorOf(result).reason, "malformed");
  });

  test("rejects a sync envelope whose rights are not a known right", () => {
    const result = Envelope.parseServer({
      room: "pixel-draw",
      kind: "sync",
      self: "a",
      rights: { "voxel-set": "admin" },
      members: []
    });

    assert.equal(errorOf(result).reason, "malformed");
  });

  test("rejects a sync envelope whose members are not peers", () => {
    const result = Envelope.parseServer({
      room: "pixel-draw",
      kind: "sync",
      self: "a",
      role: "default",

      rights: {},
      members: [{ clientId: 42 }]
    });

    assert.equal(errorOf(result).reason, "malformed");
  });

  test("rejects a peer-joined envelope with a non-string clientId", () => {
    const result = Envelope.parseServer({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: 42,
      identity: {}
    });

    assert.equal(errorOf(result).reason, "malformed");
  });

  test("rejects a client-only kind", () => {
    for (const kind of ["join", "leave", "presence"]) {
      const result = Envelope.parseServer({ room: "pixel-draw", kind });

      assert.equal(result.ok, false, `expected "${kind}" to be rejected`);
    }
  });

  test("accepts a message envelope, which travels in both directions", () => {
    const envelope = {
      room: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    };

    assert.equal(Envelope.parseServer(envelope).ok, true);
    assert.equal(Envelope.parseClient(envelope).ok, true);
  });
});

describe("Envelope.stringify", () => {
  test("serializes an envelope to a JSON string round-trippable by parseClient", () => {
    const envelope: ClientEnvelope = { room: "pixel-draw", kind: "leave" };
    const stringified = Envelope.stringify(envelope);

    assert.equal(stringified.ok, true);
    const raw = (stringified as { val: string; }).val;
    assert.equal(typeof raw, "string");

    const parsed = Envelope.parseClient(raw);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.val, envelope);
  });

  test("fails with a descriptive error for a value JSON.stringify can't serialize", () => {
    const circular: Record<string, unknown> = { hello: "world" };
    circular.self = circular;

    const result = Envelope.stringify({
      room: "pixel-draw",
      kind: "message",
      payload: circular
    });

    assert.equal(result.ok, false);
    assert.match((result as { val: string; }).val, /circular/i);
  });
});
