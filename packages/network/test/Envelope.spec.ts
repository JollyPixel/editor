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

    assert.deepEqual(result, {
      success: true,
      data: { room: "pixel-draw", kind: "leave" }
    });
  });

  test("accepts an already-deserialized object", () => {
    const result = Envelope.parse({
      room: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    });

    assert.deepEqual(result, {
      success: true,
      data: {
        room: "pixel-draw",
        kind: "message",
        payload: { hello: "world" }
      }
    });
  });

  test("fails with the JSON parse error message for malformed JSON", () => {
    const result = Envelope.parse("{not json");

    assert.equal(result.success, false);
    assert.match((result as { error: string; }).error, /invalid JSON/);
  });

  test("fails with a descriptive error for a JSON value that isn't an envelope shape", () => {
    const result = Envelope.parse(JSON.stringify({ hello: "world" }));

    assert.deepEqual(result, {
      success: false,
      error: "missing \"room\" or \"kind\" property"
    });
  });

  test("fails with a descriptive error when kind is unrecognized", () => {
    const result = Envelope.parse({ room: "pixel-draw", kind: "unknown-kind" });

    assert.deepEqual(result, {
      success: false,
      error: "unrecognized \"kind\": \"unknown-kind\""
    });
  });

  test("fails with a descriptive error when room is missing or not a string", () => {
    assert.deepEqual(Envelope.parse({ kind: "leave" }), {
      success: false,
      error: "missing \"room\" or \"kind\" property"
    });
    assert.deepEqual(Envelope.parse({ room: 42, kind: "leave" }), {
      success: false,
      error: "\"room\" must be a string"
    });
  });

  test("fails with a descriptive error for non-object input", () => {
    assert.deepEqual(Envelope.parse(null), {
      success: false,
      error: "expected an object, received object"
    });
    assert.deepEqual(Envelope.parse(42), {
      success: false,
      error: "expected an object, received number"
    });

    // A string is JSON.parse'd first, so an unparseable one fails as invalid JSON
    // rather than reaching the object-shape check.
    const result = Envelope.parse("just a string");
    assert.equal(result.success, false);
    assert.match((result as { error: string; }).error, /invalid JSON/);
  });
});

describe("Envelope.stringify", () => {
  test("serializes an envelope to a JSON string round-trippable by parse", () => {
    const envelope: Envelope = { room: "pixel-draw", kind: "leave" };
    const stringified = Envelope.stringify(envelope);

    assert.equal(stringified.success, true);
    const raw = (stringified as { data: string; }).data;
    assert.equal(typeof raw, "string");
    assert.deepEqual(Envelope.parse(raw), { success: true, data: envelope });
  });

  test("fails with a descriptive error for a value JSON.stringify can't serialize", () => {
    const circular: Record<string, unknown> = { hello: "world" };
    circular.self = circular;

    const result = Envelope.stringify({
      room: "pixel-draw",
      kind: "message",
      payload: circular
    });

    assert.equal(result.success, false);
    assert.match((result as { error: string; }).error, /circular/i);
  });
});
