// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  after,
  beforeEach,
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import {
  config,
  configure,
  resetConfig
} from "../src/config.ts";
import { BenchmarkError } from "../src/errors/index.ts";

// CONSTANTS
const kEnvKeys = [
  "BENCH_TIME_MS",
  "BENCH_ITERATIONS",
  "BENCH_WARMUP_TIME_MS",
  "BENCH_WARMUP_ITERATIONS",
  "BENCH_BATCH",
  "BENCH_FORMAT",
  "BENCH_TASK"
];

describe("config", () => {
  beforeEach(() => {
    for (const key of kEnvKeys) {
      delete process.env[key];
    }
    resetConfig();
  });

  after(() => {
    resetConfig();
  });

  it("should fall back to the built-in defaults", () => {
    assert.deepEqual(config(), {
      time: 500,
      iterations: 12,
      warmupTime: 100,
      warmupIterations: 3,
      batch: 100,
      format: "table",
      task: null
    });
  });

  it("should read every knob from the environment", () => {
    process.env.BENCH_TIME_MS = "1200";
    process.env.BENCH_ITERATIONS = "40";
    process.env.BENCH_WARMUP_TIME_MS = "50";
    process.env.BENCH_WARMUP_ITERATIONS = "9";
    process.env.BENCH_BATCH = "25";
    process.env.BENCH_FORMAT = "json";
    process.env.BENCH_TASK = "isDown";
    resetConfig();

    assert.deepEqual(config(), {
      time: 1200,
      iterations: 40,
      warmupTime: 50,
      warmupIterations: 9,
      batch: 25,
      format: "json",
      task: "isDown"
    });
  });

  it("should reject an environment value that is not a positive number", () => {
    for (const raw of ["-1", "nope", "0", "12abc"]) {
      process.env.BENCH_ITERATIONS = raw;

      assert.throws(resetConfig, (error: Error) => {
        assert.ok(error instanceof BenchmarkError);
        assert.match(error.message, /BENCH_ITERATIONS expects a positive/);

        return true;
      });
    }
  });

  it("should keep the default when a variable is unset or empty", () => {
    process.env.BENCH_TIME_MS = "";
    resetConfig();

    assert.equal(config().time, 500);
  });

  it("should reject a format it cannot print", () => {
    process.env.BENCH_FORMAT = "csv";

    assert.throws(resetConfig, (error: Error) => {
      assert.ok(error instanceof BenchmarkError);
      assert.match(error.message, /BENCH_FORMAT expects one of table, json/);

      return true;
    });
  });

  it("should override only the keys it is given", () => {
    configure({ time: 10 });

    assert.equal(config().time, 10);
    assert.equal(config().iterations, 12);
  });

  it("should ignore undefined overrides so optional flags can pass through", () => {
    configure({ time: 10 });
    configure({
      time: undefined,
      batch: 4
    });

    assert.equal(config().time, 10);
    assert.equal(config().batch, 4);
  });

  it("should clear the task filter when given null", () => {
    configure({ task: "query" });
    assert.equal(config().task, "query");

    configure({ task: null });
    assert.equal(config().task, null);
  });
});
