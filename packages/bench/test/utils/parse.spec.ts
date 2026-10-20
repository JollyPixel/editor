// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { BenchmarkError } from "../../src/errors/index.ts";
import {
  parseChoice,
  parseNonNegative,
  parsePositive
} from "../../src/utils/parse.ts";

describe("parsePositive", () => {
  it("should parse a strictly positive number", () => {
    assert.equal(parsePositive("--rate", "12"), 12);
    assert.equal(parsePositive("--rate", "0.5"), 0.5);
  });

  it("should reject anything else and name the input it rejects", () => {
    for (const raw of ["0", "-1", "nope", "12abc", "", "Infinity"]) {
      assert.throws(
        () => parsePositive("BENCH_BATCH", raw),
        (error: Error) => {
          assert.ok(error instanceof BenchmarkError);
          assert.equal(
            error.message,
            `BENCH_BATCH expects a positive number, got "${raw}"`
          );

          return true;
        }
      );
    }
  });
});

describe("parseNonNegative", () => {
  it("should accept zero but not a negative or empty value", () => {
    assert.equal(parseNonNegative("--grace", "0"), 0);
    for (const raw of ["-1", "", "nope"]) {
      assert.throws(
        () => parseNonNegative("--grace", raw),
        new RegExp(`--grace expects a number >= 0, got "${raw}"`)
      );
    }
  });
});

describe("parseChoice", () => {
  it("should accept a listed choice and reject any other", () => {
    assert.equal(parseChoice("--store", "memory", ["sqlite", "memory"]), "memory");
    assert.throws(
      () => parseChoice("--store", "redis", ["sqlite", "memory"]),
      /--store expects one of sqlite, memory, got "redis"/
    );
  });
});
