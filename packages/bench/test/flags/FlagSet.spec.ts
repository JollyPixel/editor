// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { BenchmarkError } from "../../src/errors/index.ts";
import { Flag } from "../../src/flags/Flag.ts";
import { FlagSet } from "../../src/flags/FlagSet.ts";

function fixtureFlags(): FlagSet<{ rate: number; json: boolean; }> {
  return new FlagSet({
    rate: Flag.positive(30, "actions per second", "hz")
  }).extend({
    json: Flag.toggle("print JSON")
  });
}

describe("FlagSet", () => {
  it("should parse every flag, defaults included, and keep positionals", () => {
    const parsed = fixtureFlags().parse(["loop", "--json"], {
      allowPositionals: true
    });

    assert.deepEqual(parsed, {
      help: false,
      values: {
        rate: 30,
        json: true
      },
      positionals: ["loop"]
    });
  });

  it("should answer --help before validating the other flags", () => {
    assert.deepEqual(
      fixtureFlags().parse(["--rate", "0", "--help"]),
      { help: true }
    );
  });

  it("should reject an unknown option as a BenchmarkError", () => {
    assert.throws(
      () => fixtureFlags().parse(["--rates", "2"]),
      (error: Error) => {
        assert.ok(error instanceof BenchmarkError);
        assert.match(error.message, /--rates/);

        return true;
      }
    );
  });

  it("should list the flags in order, help last", () => {
    const lines = fixtureFlags().usage().split("\n");

    assert.deepEqual(lines.map((line) => line.trim().split(" ")[0]), [
      "--rate",
      "--json",
      "--help"
    ]);
  });
});
