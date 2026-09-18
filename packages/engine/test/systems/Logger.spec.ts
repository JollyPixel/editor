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
});
