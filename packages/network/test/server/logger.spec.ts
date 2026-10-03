// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createLogger } from "#src/server/logger.ts";
import { ServerRoom } from "#src/server/room/ServerRoom.ts";
import { createExtension } from "../helpers/server/serverRoom.ts";

describe("createLogger", () => {
  test("gates levels below the pino level before building metadata", () => {
    const logger = createLogger("test");

    assert.strictEqual(logger.isLevelEnabled("info"), true);
    assert.strictEqual(logger.isLevelEnabled("debug"), false);
  });
});

describe("ServerRoom logger", () => {
  test("adds its room to a child, not to the logger it is given", () => {
    const logger = createLogger("test");

    new ServerRoom("a", createExtension(), undefined, { logger });
    new ServerRoom("b", createExtension(), undefined, { logger });

    assert.deepEqual(logger.getContext(), {});
  });
});
