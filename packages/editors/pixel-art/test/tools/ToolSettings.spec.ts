// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ToolSettings,
  type ToolSettingsInit
} from "../../src/tools/ToolSettings.ts";
import { makeToolCanvas } from "./fixtures/toolCanvas.ts";

// CONSTANTS
const kInit: ToolSettingsInit = {
  mode: "paint",
  brushSize: 7,
  options: {
    pickColor: true,
    fillGlobal: true,
    fillUvClip: true,
    selectShape: true
  },
  primary: {
    hex: "#123456",
    opacity: 0.5
  },
  secondary: {
    hex: "#abcdef",
    opacity: 1
  }
};

describe("UI.ToolSettings", () => {
  test("round-trips every setting between two canvases", () => {
    const source = makeToolCanvas("move");
    const target = makeToolCanvas("move");
    new ToolSettings(kInit).applyTo(source.canvas);

    ToolSettings.capture(source.canvas).applyTo(target.canvas);

    assert.deepEqual({ ...ToolSettings.capture(target.canvas) }, kInit);
  });

  test("keeps the eyedropper disarmed outside Paint mode", () => {
    const { state, canvas } = makeToolCanvas("paint");

    new ToolSettings({
      ...kInit,
      mode: "fill"
    }).applyTo(canvas);

    assert.equal(state.mode, "fill");
    assert.equal(state.tools.brush.pickArmed, false);
  });

  test("copies its inputs and cannot be mutated", () => {
    const options = { ...kInit.options };
    const primary = { ...kInit.primary };
    const settings = new ToolSettings({
      ...kInit,
      options,
      primary
    });

    options.pickColor = false;
    primary.hex = "#000000";

    assert.equal(settings.options.pickColor, true);
    assert.equal(settings.primary.hex, "#123456");
    assert.ok(Object.isFrozen(settings));
    assert.ok(Object.isFrozen(settings.options));
    assert.ok(Object.isFrozen(settings.primary));
  });

  test("a captured snapshot ignores later canvas edits", () => {
    const { state, canvas } = makeToolCanvas("paint");
    const settings = ToolSettings.capture(canvas);

    state.brush.size = 12;
    state.brush.primary.set("#ff0000", 0.25);

    assert.equal(settings.brushSize, 1);
    assert.deepEqual(settings.primary, {
      hex: "#000000",
      opacity: 1
    });
  });
});
