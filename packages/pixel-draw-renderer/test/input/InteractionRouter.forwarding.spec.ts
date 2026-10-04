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
  test("forwards pointer actions to the active mode and returns its result", () => {
    const { router, modes } = makeRouter();

    const handled = router.onPrimaryDown({ x: 4, y: 7 }, { x: 40, y: 70 });
    router.onPrimaryMove({ x: 5, y: 8 }, { x: 50, y: 80 });
    router.onPrimaryUp();

    assert.strictEqual(handled, true);
    assert.deepStrictEqual(
      modes[0].calls,
      ["down:4,7@40,70", "move:5,8@50,80", "up"]
    );
  });

  test("re-syncs the cursor after a primary press/release and on blur", () => {
    const { router, recorder } = makeRouter({
      modes: [new FakeMode("select", "grab")],
      defaultMode: "select"
    });

    router.onPrimaryDown({ x: 1, y: 1 }, { x: 1, y: 1 });
    router.onPrimaryUp();
    router.onBlur();

    assert.deepStrictEqual(
      recorder.cursor,
      ["grab", "grab", "grab"]
    );
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
