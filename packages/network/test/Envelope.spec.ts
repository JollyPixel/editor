// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Envelope } from "#src/Envelope.ts";

describe("Envelope.parse", () => {
  test("parses a valid JSON string into an envelope", () => {
    const result = Envelope.parse(JSON.stringify({ room: "pixel-draw", kind: "leave" }));

    assert.equal(result.ok, true);
    assert.deepEqual(result.val, { room: "pixel-draw", kind: "leave" });
  });

  test("accepts a \"denied\" envelope", () => {
    const result = Envelope.parse({
      room: "pixel-draw",
      kind: "denied",
      event: "$join",
      reason: "role \"viewer\" is not permitted to join this room"
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.val, {
      room: "pixel-draw",
      kind: "denied",
      event: "$join",
      reason: "role \"viewer\" is not permitted to join this room"
    });
  });

  test("accepts an already-deserialized object", () => {
    const result = Envelope.parse({
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

  test("fails with the JSON parse error message for malformed JSON", () => {
    const result = Envelope.parse("{not json");

    assert.equal(result.ok, false);
    assert.match((result as { val: string; }).val, /invalid JSON/);
  });

  test("fails with a descriptive error for a JSON value that isn't an envelope shape", () => {
    const result = Envelope.parse(JSON.stringify({ hello: "world" }));

    assert.equal(result.ok, false);
    assert.equal((result as { val: string; }).val, "missing \"room\" or \"kind\" property");
  });

  test("fails with a descriptive error when kind is unrecognized", () => {
    const result = Envelope.parse({ room: "pixel-draw", kind: "unknown-kind" });

    assert.equal(result.ok, false);
    assert.equal((result as { val: string; }).val, "unrecognized \"kind\": \"unknown-kind\"");
  });

  test("fails with a descriptive error when room is missing or not a string", () => {
    const missingRoom = Envelope.parse({ kind: "leave" });
    assert.equal(missingRoom.ok, false);
    assert.equal((missingRoom as { val: string; }).val, "missing \"room\" or \"kind\" property");

    const invalidRoom = Envelope.parse({ room: 42, kind: "leave" });
    assert.equal(invalidRoom.ok, false);
    assert.equal((invalidRoom as { val: string; }).val, "\"room\" must be a string");
  });

  test("fails with a descriptive error for non-object input", () => {
    const nullResult = Envelope.parse(null);
    assert.equal(nullResult.ok, false);
    assert.equal((nullResult as { val: string; }).val, "expected an object, received object");

    const numberResult = Envelope.parse(42);
    assert.equal(numberResult.ok, false);
    assert.equal((numberResult as { val: string; }).val, "expected an object, received number");

    // A string is JSON.parse'd first, so an unparseable one fails as invalid JSON
    // rather than reaching the object-shape check.
    const result = Envelope.parse("just a string");
    assert.equal(result.ok, false);
    assert.match((result as { val: string; }).val, /invalid JSON/);
  });
});

describe("Envelope.stringify", () => {
  test("serializes an envelope to a JSON string round-trippable by parse", () => {
    const envelope: Envelope = { room: "pixel-draw", kind: "leave" };
    const stringified = Envelope.stringify(envelope);

    assert.equal(stringified.ok, true);
    const raw = (stringified as { val: string; }).val;
    assert.equal(typeof raw, "string");

    const parsed = Envelope.parse(raw);
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
