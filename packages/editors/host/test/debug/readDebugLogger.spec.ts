// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  DEBUG_STORAGE_KEY,
  readDebugLogger
} from "#src/debug/readDebugLogger.ts";

function storageWith(
  value: string | null
): Pick<Storage, "getItem"> {
  return {
    getItem: (key) => (key === DEBUG_STORAGE_KEY ? value : null)
  };
}

function enabled(
  logger: ReturnType<typeof readDebugLogger>,
  namespace: string
): boolean {
  return logger.child({ namespace }).isNamespaceEnabled();
}

describe("readDebugLogger", () => {
  test("enables nothing without a switch", () => {
    const logger = readDebugLogger({
      search: "",
      storage: storageWith(null)
    });

    assert.equal(enabled(logger, "host.boot"), false);
  });

  test("enables the comma-separated namespaces of ?debug=", () => {
    const logger = readDebugLogger({
      search: "?debug=host.*, studio.tabs",
      storage: storageWith("editor")
    });

    assert.equal(logger.isLevelEnabled("debug"), true);
    assert.equal(enabled(logger, "host.boot"), true);
    assert.equal(enabled(logger, "studio.tabs"), true);
    assert.equal(enabled(logger, "editor"), false);
  });

  test("enables every namespace for a bare ?debug", () => {
    const logger = readDebugLogger({
      search: "?debug",
      storage: storageWith(null)
    });

    assert.equal(enabled(logger, "editor.scene"), true);
  });

  test("falls back to the stored namespaces", () => {
    const logger = readDebugLogger({
      search: "",
      storage: storageWith("editor.*")
    });

    assert.equal(enabled(logger, "editor.scene"), true);
    assert.equal(enabled(logger, "host.boot"), false);
  });

  test("enables nothing when the storage throws", () => {
    const logger = readDebugLogger({
      search: "",
      storage: {
        getItem: () => {
          throw new Error("denied");
        }
      }
    });

    assert.equal(enabled(logger, "host.boot"), false);
  });
});
