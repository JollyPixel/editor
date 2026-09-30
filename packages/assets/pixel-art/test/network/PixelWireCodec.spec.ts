// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  packPixelEvent,
  unpackColors,
  unpackPixelCommand,
  unpackPositions
} from "#src/network/PixelWireCodec.ts";
import {
  command,
  gray,
  packed,
  wholeCanvasCommands
} from "../fixtures/commands.ts";

describe("PixelWireCodec", () => {
  test("unpacks a packed stroke and select-edit back to their original form", () => {
    const stroke = command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 1 }, { x: 2, y: 3 }]
    });
    const selectEdit = command("select-edit", {
      positions: [{ x: 4, y: 5 }],
      colors: [gray(6)]
    });

    assert.deepStrictEqual(unpackPixelCommand(packed(stroke)), stroke);
    assert.deepStrictEqual(unpackPixelCommand(packed(selectEdit)), selectEdit);
  });

  test("unpacks a command stored in the unpacked form unchanged", () => {
    const stroke = command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 1 }]
    });

    assert.deepStrictEqual(unpackPixelCommand(stroke), stroke);
  });

  test("leaves every other command as is", () => {
    for (const other of wholeCanvasCommands()) {
      assert.strictEqual(packPixelEvent(other), other);
      assert.strictEqual(unpackPixelCommand(other), other);
    }
  });

  test("drops a trailing coordinate or partial color", () => {
    assert.deepStrictEqual(unpackPositions([1, 2, 3]), [{ x: 1, y: 2 }]);
    assert.deepStrictEqual(unpackColors([1, 2, 3, 4, 5]), [{
      r: 1,
      g: 2,
      b: 3,
      a: 4
    }]);
  });
});
