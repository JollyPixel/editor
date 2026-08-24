// Import Node.js Dependencies
import assert from "node:assert/strict";
import path from "node:path";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { BenchmarkError } from "../src/errors/index.ts";
import {
  discover,
  loadSuite
} from "../src/discover.ts";

// CONSTANTS
const kFixtures = path.join(import.meta.dirname, "fixtures");

describe("discover", () => {
  it("should list every bench file sorted, with forward slashes", () => {
    assert.deepEqual(discover({ cwd: kFixtures }), [
      "bench/alpha.bench.ts",
      "bench/beta.bench.ts",
      "bench/broken.bench.ts",
      "bench/nested/gamma.bench.ts"
    ]);
  });

  it("should keep only the files matching a filter", () => {
    assert.deepEqual(discover({ cwd: kFixtures, filters: ["alpha"] }), [
      "bench/alpha.bench.ts"
    ]);
  });

  it("should keep the files matching any filter, case-insensitively", () => {
    assert.deepEqual(
      discover({ cwd: kFixtures, filters: ["ALPHA", "gamma"] }),
      [
        "bench/alpha.bench.ts",
        "bench/nested/gamma.bench.ts"
      ]
    );
  });

  it("should match a filter against the whole path", () => {
    assert.deepEqual(discover({ cwd: kFixtures, filters: ["nested/"] }), [
      "bench/nested/gamma.bench.ts"
    ]);
  });

  it("should drop the ignored files before filtering", () => {
    assert.deepEqual(
      discover({ cwd: kFixtures, ignore: ["broken.bench.ts", "nested"] }),
      [
        "bench/alpha.bench.ts",
        "bench/beta.bench.ts"
      ]
    );
  });

  it("should return nothing when no file matches", () => {
    assert.deepEqual(discover({ cwd: kFixtures, filters: ["absent"] }), []);
  });

  it("should honor a custom pattern", () => {
    assert.deepEqual(
      discover({ cwd: kFixtures, pattern: "bench/*.bench.ts" }),
      [
        "bench/alpha.bench.ts",
        "bench/beta.bench.ts",
        "bench/broken.bench.ts"
      ]
    );
  });
});

describe("loadSuite", () => {
  it("should return the default-exported suite", async() => {
    const suite = await loadSuite("bench/alpha.bench.ts", kFixtures);

    assert.equal(suite.name, "fixtures / alpha");
    assert.equal(typeof suite.run, "function");
  });

  it("should reject a file that exports no suite", async() => {
    await assert.rejects(
      () => loadSuite("bench/broken.bench.ts", kFixtures),
      (error: Error) => {
        assert.ok(error instanceof BenchmarkError);
        assert.match(error.message, /must default-export a suite/);

        return true;
      }
    );
  });
});
