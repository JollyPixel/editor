// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { protocolEvents } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  isPixelCommandAction,
  PIXEL_COMMAND_ACTIONS
} from "#src/network/pixelCommandActions.ts";
import { pixelCommandProtocol } from "#src/network/PixelCommand.schema.ts";

describe("PIXEL_COMMAND_ACTIONS", () => {
  test("names exactly the actions the protocol accepts", () => {
    assert.deepEqual(
      [...PIXEL_COMMAND_ACTIONS].toSorted(),
      protocolEvents(pixelCommandProtocol).toSorted()
    );
  });

  test("recognizes a pixel action and nothing else", () => {
    assert.strictEqual(isPixelCommandAction("stroke"), true);
    assert.strictEqual(isPixelCommandAction("uv-region-rotated"), true);
    assert.strictEqual(isPixelCommandAction("block-defined"), false);
    assert.strictEqual(isPixelCommandAction("toString"), false);
  });
});
