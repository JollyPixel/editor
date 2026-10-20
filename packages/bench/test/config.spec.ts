// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { BenchmarkConfig } from "../src/config.ts";
import { BenchmarkError } from "../src/errors/index.ts";

describe("BenchmarkConfig.fromEnvironment", () => {
  it("should fall back to the built-in defaults", () => {
    assert.deepEqual({ ...BenchmarkConfig.fromEnvironment({}) }, {
      time: 500,
      iterations: 12,
      warmupTime: 100,
      warmupIterations: 3,
      batch: 100,
      format: "table",
      task: null,
      allocations: false
    });
  });

  it("should read every knob from the environment", () => {
    const config = BenchmarkConfig.fromEnvironment({
      BENCH_TIME_MS: "1200",
      BENCH_ITERATIONS: "40",
      BENCH_WARMUP_TIME_MS: "50",
      BENCH_WARMUP_ITERATIONS: "9",
      BENCH_BATCH: "25",
      BENCH_FORMAT: "json",
      BENCH_TASK: "isDown",
      BENCH_ALLOCATIONS: "1"
    });

    assert.deepEqual({ ...config }, {
      time: 1200,
      iterations: 40,
      warmupTime: 50,
      warmupIterations: 9,
      batch: 25,
      format: "json",
      task: "isDown",
      allocations: true
    });
  });

  it("should reject an environment value that is not a positive number", () => {
    for (const raw of ["-1", "nope", "0", "12abc"]) {
      assert.throws(
        () => BenchmarkConfig.fromEnvironment({ BENCH_ITERATIONS: raw }),
        (error: Error) => {
          assert.ok(error instanceof BenchmarkError);
          assert.match(error.message, /BENCH_ITERATIONS expects a positive/);

          return true;
        }
      );
    }
  });

  it("should keep the default when a variable is empty", () => {
    assert.equal(BenchmarkConfig.fromEnvironment({ BENCH_TIME_MS: "" }).time, 500);
  });

  it("should reject a format it cannot print", () => {
    assert.throws(
      () => BenchmarkConfig.fromEnvironment({ BENCH_FORMAT: "csv" }),
      (error: Error) => {
        assert.ok(error instanceof BenchmarkError);
        assert.match(error.message, /BENCH_FORMAT expects one of table, json/);

        return true;
      }
    );
  });

  it("should reject an allocations switch it cannot read", () => {
    assert.throws(
      () => BenchmarkConfig.fromEnvironment({ BENCH_ALLOCATIONS: "yes" }),
      (error: Error) => {
        assert.ok(error instanceof BenchmarkError);
        assert.match(
          error.message,
          /BENCH_ALLOCATIONS expects 1, 0, true or false/
        );

        return true;
      }
    );
  });
});
