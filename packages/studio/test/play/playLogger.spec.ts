// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { playLogger } from "../../src/play/playLogger.ts";

function createPlayLogger(
  t: TestContext,
  search = ""
) {
  for (const method of ["log", "warn", "error"] as const) {
    t.mock.method(console, method, () => undefined);
  }
  const warnings: string[] = [];
  const failures: Array<[message: string, cause: unknown]> = [];
  const logger = playLogger({
    search,
    warned: (message) => warnings.push(message),
    failed: (message, cause) => failures.push([message, cause])
  });

  return { logger, warnings, failures };
}

describe("playLogger", () => {
  test("forwards each engine warning as one line with its details", (t) => {
    const { logger, warnings } = createPlayLogger(t);

    logger.child({ namespace: "ecs.scene-instance" }).warn(
      "Missing asset skipped",
      {
        actor: "hero",
        type: "Model",
        assetId: "ghost"
      }
    );
    logger.child({ namespace: "ecs.world" }).info("Scene changed");
    logger.warn("Prefab cycle skipped");

    assert.deepStrictEqual(warnings, [
      "Missing asset skipped (actor: hero, type: Model, assetId: ghost)",
      "Prefab cycle skipped"
    ]);
  });

  test("forwards a logged error as a failure with its cause", async(t) => {
    const { logger, failures } = createPlayLogger(t);
    const error = new Error("unreachable");

    await assert.rejects(
      logger.step("scene", () => Promise.reject(error)),
      error
    );
    logger.child({ namespace: "three" }).error("GPU device lost");

    assert.deepStrictEqual(failures, [
      ["scene failed (error: unreachable)", error],
      ["GPU device lost", undefined]
    ]);
  });

  test("enables every level for the namespaces of ?debug=", (t) => {
    const { logger } = createPlayLogger(t, "?debug=ecs.*");

    assert.equal(logger.isLevelEnabled("trace"), true);
    assert.equal(logger.child({ namespace: "ecs.world" }).isNamespaceEnabled(), true);
    assert.equal(logger.child({ namespace: "three" }).isNamespaceEnabled(), false);
  });
});
