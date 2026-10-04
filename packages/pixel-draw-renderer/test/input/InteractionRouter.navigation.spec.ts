// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FakeMode,
  makeRouter
} from "../helpers/input/router.ts";

describe("InteractionRouter", () => {
  test("blur clears both held modifiers without a separate release", () => {
    const { router, recorder, modes } = makeRouter({
      modes: [new FakeMode("paint", "crosshair")],
      defaultMode: "paint"
    });

    router.panHeld = true;
    router.lineHeld = true;
    router.onBlur();

    assert.strictEqual(router.panHeld, false);
    assert.strictEqual(router.lineHeld, false);
    assert.deepStrictEqual(modes[0].calls, ["line-held", "blur"]);
    assert.deepStrictEqual(recorder.cursor, ["grab", "crosshair"]);
  });

  test("handles pan and zoom itself, never touching the active mode", () => {
    const { router, recorder, modes } = makeRouter();

    router.onPanMove({ x: 3, y: -4 });
    router.onZoom(120, { x: 10, y: 20 });

    assert.deepStrictEqual(recorder.pan, [[3, -4]]);
    assert.deepStrictEqual(recorder.zoom, [[120, 10, 20]]);
    assert.deepStrictEqual(modes[0].calls, []);
  });

  test("a pan gesture shows grabbing, then restores the mode cursor on end", () => {
    const { router, recorder } = makeRouter({
      modes: [new FakeMode("paint", "crosshair")],
      defaultMode: "paint"
    });

    router.onPanStart();
    router.onPanEnd();

    assert.deepStrictEqual(recorder.cursor, ["grabbing", "crosshair"]);
  });

  test("panHeld arms a grab cursor and a pan restores to grab while it stays held", () => {
    const { router, recorder } = makeRouter({
      modes: [new FakeMode("paint", "crosshair")],
      defaultMode: "paint"
    });

    router.panHeld = true;
    router.panHeld = true;
    router.onPanStart();
    router.onPanEnd();
    router.panHeld = false;

    assert.deepStrictEqual(
      recorder.cursor,
      ["grab", "grabbing", "grab", "crosshair"]
    );
  });
});
