// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import {
  choiceArg,
  nonNegativeArg,
  readLoadArgs
} from "../../src/load/loadArgs.ts";

describe("readLoadArgs", () => {
  it("should convert seconds to milliseconds and cap workers to clients", () => {
    const args = readLoadArgs({
      clients: "3",
      rate: "20",
      duration: "1.5",
      warmup: "2",
      workers: "8",
      compression: true,
      json: false,
      help: false
    }, "");

    assert.deepEqual(args, {
      clients: 3,
      rate: 20,
      durationMs: 1_500,
      warmupMs: 2_000,
      workers: 3,
      compression: true,
      profile: undefined,
      json: false
    });
  });

  it("should name the flag that is not a positive number", () => {
    assert.throws(() => readLoadArgs({
      clients: "50",
      rate: "0",
      duration: "10",
      warmup: "2",
      workers: "2",
      compression: false,
      json: false,
      help: false
    }, ""), /--rate expects a positive number, got "0"/);
  });
});

describe("choiceArg and nonNegativeArg", () => {
  it("should accept a listed choice and zero", () => {
    assert.equal(choiceArg("store", "memory", ["sqlite", "memory"]), "memory");
    assert.equal(nonNegativeArg("grace", "0"), 0);
  });

  it("should reject an unlisted choice and a negative number", () => {
    assert.throws(
      () => choiceArg("store", "redis", ["sqlite", "memory"]),
      /--store expects one of sqlite, memory/
    );
    assert.throws(
      () => nonNegativeArg("grace", "-1"),
      /--grace expects a number >= 0, got "-1"/
    );
  });
});
