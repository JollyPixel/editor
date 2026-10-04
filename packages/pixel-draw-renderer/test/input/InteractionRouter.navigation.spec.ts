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
      modes: [new FakeMode("paint", { cursor: "crosshair" })],
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

  test("a pan gesture shows grabbing, then restores the mode cursor on end", () => {
    const { router, recorder } = makeRouter({
      modes: [new FakeMode("paint", { cursor: "crosshair" })],
      defaultMode: "paint"
    });

    router.onPanStart();
    router.onPanEnd();

    assert.deepStrictEqual(recorder.cursor, ["grabbing", "crosshair"]);
  });

  test("panHeld arms a grab cursor and a pan restores to grab while it stays held", () => {
    const { router, recorder } = makeRouter({
      modes: [new FakeMode("paint", { cursor: "crosshair" })],
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

  test("panning keeps the grabbing cursor while panHeld changes or the pointer hovers", () => {
    const { router, recorder } = makeRouter({
      modes: [new FakeMode("paint", { cursor: "crosshair" })],
      defaultMode: "paint"
    });

    router.onPanStart();
    router.panHeld = true;
    router.onHover(null);

    assert.deepStrictEqual(
      recorder.cursor,
      ["grabbing", "grabbing", "grabbing"]
    );
  });

  test("a primary drag pans while panHeld is set or when the active mode pans on primary", () => {
    const { router } = makeRouter({
      modes: [
        new FakeMode("paint"),
        new FakeMode("move", { pansOnPrimary: true })
      ],
      defaultMode: "paint"
    });

    assert.strictEqual(router.pansOnPrimary, false);
    router.panHeld = true;
    assert.strictEqual(router.pansOnPrimary, true);
    router.panHeld = false;
    router.mode = "move";
    assert.strictEqual(router.pansOnPrimary, true);
  });
});
