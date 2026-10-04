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
  test("forwards pointer actions with their slot to the active mode and returns its result", () => {
    const { router, modes } = makeRouter();

    const handled = router.onPointerDown(
      "secondary",
      pointerAt({ x: 4, y: 7 }, { x: 40, y: 70 }),
      true
    );
    router.onPointerMove("secondary", pointerAt({ x: 5, y: 8 }, { x: 50, y: 80 }));
    router.onPointerUp("secondary");

    assert.strictEqual(handled, true);
    assert.deepStrictEqual(
      modes[0].calls,
      ["down:secondary:4,7@40,70:ctrl", "move:secondary:5,8@50,80", "up:secondary"]
    );
  });

  test("re-syncs the cursor after a press/release and on blur", () => {
    const { router, recorder } = makeRouter({
      modes: [new FakeMode("select", { cursor: "grab" })],
      defaultMode: "select"
    });

    router.onPointerDown("primary", pointerAt({ x: 1, y: 1 }), false);
    router.onPointerUp("primary");
    router.onBlur();

    assert.deepStrictEqual(
      recorder.cursor,
      ["grab", "grab", "grab"]
    );
  });

  test("hover reports the canvas position, then the bounded texture cursor to the mode and listener", () => {
    const { router, modes } = makeRouter();
    const external: unknown[] = [];
    router.onExternalCursorMove = (position) => external.push(position);

    router.onHover({
      canvas: { x: 40, y: 70 },
      texture: { x: 20, y: 3 },
      boundedTexture: null
    });
    router.onHover(pointerAt({ x: 4, y: 7 }, { x: 41, y: 71 }));
    router.onHover(null);

    assert.deepStrictEqual(modes[0].calls, [
      "hover:40,70",
      "cursor:none",
      "hover:41,71",
      "cursor:4,7",
      "hover:none",
      "cursor:none"
    ]);
    assert.deepStrictEqual(external, [null, { x: 4, y: 7 }, null]);
    assert.strictEqual(router.textureCursor, null);
  });

  test("routes ctrl+wheel to the active mode", () => {
    const { router, modes } = makeRouter();

    assert.strictEqual(router.onCtrlWheel(-3), true);
    assert.deepStrictEqual(modes[0].calls, ["ctrl-wheel:-3"]);
  });

  test("routes edit shortcuts to the active mode and returns whether it handled them", () => {
    const { router, modes } = makeRouter({
      modes: [new FakeMode("select")],
      defaultMode: "select"
    });

    const handled = [
      router.delete(),
      router.rotate("ccw"),
      router.flipHorizontal(),
      router.flipVertical()
    ];

    assert.deepStrictEqual(handled, [true, true, false, true]);
    assert.deepStrictEqual(
      modes[0].calls,
      ["delete", "rotate:ccw", "flip-horizontal", "flip-vertical"]
    );
  });

  test("lineHeld reports each change once to the active mode", () => {
    const { router, modes } = makeRouter();

    router.lineHeld = true;
    router.lineHeld = true;
    router.lineHeld = false;
    router.lineHeld = false;

    assert.strictEqual(router.lineHeld, false);
    assert.deepStrictEqual(modes[0].calls, ["line-held", "line-released"]);
  });
});
