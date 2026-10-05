// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FakeMode,
  makeRouter,
  pointerAt
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

  test("panHeld hides the mode hover and restores it at the last position on release", () => {
    const { router, modes } = makeRouter({
      modes: [new FakeMode("paint")],
      defaultMode: "paint"
    });

    router.onHover(pointerAt({ x: 4, y: 4 }));
    router.panHeld = true;
    router.onHover(pointerAt({ x: 6, y: 6 }));
    router.panHeld = false;

    assert.deepStrictEqual(modes[0].calls, [
      "hover:4,4",
      "cursor:4,4",
      "hover:none",
      "cursor:6,6",
      "hover:6,6"
    ]);
  });

  test("a pan gesture keeps the mode hover hidden until both pan and panHeld end", () => {
    const { router, modes } = makeRouter({
      modes: [new FakeMode("paint")],
      defaultMode: "paint"
    });

    router.onHover(pointerAt({ x: 4, y: 4 }));
    modes[0].calls.length = 0;
    router.onPanStart();
    router.panHeld = true;
    router.onPanEnd();
    assert.deepStrictEqual(modes[0].calls, ["hover:none"]);

    router.panHeld = false;
    assert.deepStrictEqual(modes[0].calls, ["hover:none", "hover:4,4"]);
  });

  test("Ctrl+wheel falls back to zoom while panHeld is set", () => {
    const { router, modes } = makeRouter({
      modes: [new FakeMode("paint")],
      defaultMode: "paint"
    });

    router.panHeld = true;

    assert.strictEqual(router.onCtrlWheel(-100), false);
    assert.deepStrictEqual(modes[0].calls, []);
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
