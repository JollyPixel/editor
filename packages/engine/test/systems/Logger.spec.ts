// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Logger } from "../../src/systems/Logger.ts";

function createAdapter() {
  return {
    log: mock.fn(),
    warn: mock.fn(),
    error: mock.fn()
  };
}

describe("Systems.Logger", () => {
  test("should route each level to its console method", () => {
    const adapter = createAdapter();
    const logger = new Logger({ level: "trace", namespaces: ["*"], adapter })
      .child({ namespace: "systems" });

    logger.debug("debug");
    logger.warn("warn", { reason: "test" });
    logger.fatal("fatal");

    assert.deepEqual(adapter.log.mock.calls[0].arguments, ["[DEBUG] [systems] debug"]);
    assert.deepEqual(adapter.warn.mock.calls[0].arguments, ["[WARN] [systems] warn", { reason: "test" }]);
    assert.deepEqual(adapter.error.mock.calls[0].arguments, ["[FATAL] [systems] fatal"]);
  });

  test("should drop messages below the minimum level", () => {
    const adapter = createAdapter();
    const logger = new Logger({ level: "warn", namespaces: ["*"], adapter });

    logger.info("info");
    logger.error("error");

    assert.strictEqual(adapter.log.mock.callCount(), 0);
    assert.strictEqual(adapter.error.mock.callCount(), 1);
  });

  test("should silence every level with void", () => {
    const adapter = createAdapter();
    const logger = new Logger({ level: "void", namespaces: ["*"], adapter });

    logger.fatal("fatal");
    logger.error("error");

    assert.strictEqual(adapter.error.mock.callCount(), 0);
  });

  test("should log a step around the operation it runs", async() => {
    const adapter = createAdapter();
    const logger = new Logger({ level: "debug", namespaces: ["*"], adapter })
      .child({ namespace: "boot" });

    const result = await logger.step(
      "load",
      () => Promise.resolve(42),
      { id: "map" }
    );

    assert.strictEqual(result, 42);
    assert.deepEqual(adapter.log.mock.calls[0].arguments, [
      "[DEBUG] [boot] load started",
      { id: "map" }
    ]);
    const [line, meta] = adapter.log.mock.calls[1].arguments;
    assert.strictEqual(line, "[DEBUG] [boot] load done");
    assert.strictEqual(meta.id, "map");
    assert.strictEqual(typeof meta.ms, "number");
  });

  test("should log a failed step and rethrow its error", async() => {
    const adapter = createAdapter();
    const logger = new Logger({ level: "debug", namespaces: ["*"], adapter });
    const error = new Error("unreachable");

    await assert.rejects(
      logger.step("connect", () => Promise.reject(error)),
      error
    );

    assert.deepEqual(adapter.error.mock.calls[0].arguments, [
      "[ERROR] [root] connect failed",
      { error }
    ]);
  });

  test("should leave a pending step at its started line", () => {
    const adapter = createAdapter();
    const logger = new Logger({ level: "debug", namespaces: ["*"], adapter });

    void logger.step("scene", () => new Promise<void>(() => void 0));

    assert.deepEqual(adapter.log.mock.calls.map((call) => call.arguments), [
      ["[DEBUG] [root] scene started"]
    ]);
  });
});
