// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyToolOption,
  readToolOptions
} from "../../src/tools/toolOptions.ts";
import { makeToolCanvas } from "./fixtures/toolCanvas.ts";

describe("UI.toolOptions", () => {
  test("an option switches to the mode it belongs to", () => {
    const { state, canvas } = makeToolCanvas("move");

    applyToolOption(canvas, {
      name: "fillUvClip",
      value: true
    });

    assert.equal(state.mode, "fill");
    assert.deepEqual(readToolOptions(canvas), {
      pickColor: false,
      fillGlobal: false,
      fillUvClip: true,
      selectShape: false
    });
  });

  test("arming the eyedropper switches to Paint mode", () => {
    const { state, canvas } = makeToolCanvas("select");

    applyToolOption(canvas, {
      name: "pickColor",
      value: true
    });

    assert.equal(state.mode, "paint");
    assert.equal(state.tools.brush.pickArmed, true);
  });
});
