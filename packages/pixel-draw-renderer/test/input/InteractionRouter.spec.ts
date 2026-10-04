// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Mode } from "#src/types.ts";
import {
  FakeMode,
  makeRouter
} from "../helpers/input/router.ts";

function makeModalRouter() {
  return makeRouter({
    modes: [
      new FakeMode("paint", { writesPixels: true }),
      new FakeMode("fill", { writesPixels: true }),
      new FakeMode("select"),
      new FakeMode("move", { cursor: "grab" })
    ],
    defaultMode: "fill"
  });
}

describe("InteractionRouter", () => {
  test("starts on the default mode without an exit or cursor sync", () => {
    const { router, recorder, modes } = makeRouter();

    assert.strictEqual(router.mode, "paint");
    assert.deepStrictEqual(modes[0].calls, []);
    assert.deepStrictEqual(recorder.cursor, []);
  });

  test("constructing with an unknown default mode throws", () => {
    assert.throws(
      () => makeRouter({ defaultMode: "nope" as Mode }),
      /Unknown default mode: "nope"/
    );
  });

  test("switching mode runs the leaving onExit, syncs the cursor and reports the change", () => {
    const { router, recorder, modes } = makeRouter();

    router.mode = "select";

    assert.strictEqual(router.mode, "select");
    assert.deepStrictEqual(modes[0].calls, ["exit"]);
    assert.deepStrictEqual(modes[1].calls, []);
    assert.deepStrictEqual(recorder.cursor, ["grab"]);
    assert.deepStrictEqual(recorder.modeChanges, [["select", "paint"]]);
  });

  test("setting the current mode again is a no-op (no exit/cursor)", () => {
    const { router, recorder, modes } = makeRouter();

    router.mode = "paint";

    assert.deepStrictEqual(modes[0].calls, []);
    assert.deepStrictEqual(recorder.cursor, []);
  });

  test("switching to an unknown mode throws and leaves the active mode untouched", () => {
    const { router, modes } = makeRouter();

    assert.throws(
      () => {
        router.mode = "nope" as Mode;
      },
      /Unknown mode: "nope"/
    );
    assert.strictEqual(router.mode, "paint");
    assert.deepStrictEqual(modes[0].calls, []);
  });

  describe("pixelsReadOnly", () => {
    test("makes the pixel-writing modes unavailable", () => {
      const { router } = makeModalRouter();

      assert.strictEqual(router.unavailableModes.size, 0);
      router.pixelsReadOnly = true;

      assert.deepStrictEqual([...router.unavailableModes], ["paint", "fill"]);
      assert.strictEqual(router.unavailableModes, router.unavailableModes);
    });

    test("displaces a pixel-writing mode to move, then restores it", () => {
      const { router, recorder } = makeModalRouter();

      router.pixelsReadOnly = true;
      assert.strictEqual(router.mode, "move");

      router.pixelsReadOnly = false;
      assert.strictEqual(router.mode, "fill");
      assert.deepStrictEqual(
        recorder.modeChanges,
        [["move", "fill"], ["fill", "move"]]
      );
    });

    test("ignores an unavailable mode", () => {
      const { router } = makeModalRouter();

      router.pixelsReadOnly = true;
      router.mode = "paint";

      assert.strictEqual(router.mode, "move");
    });

    test("a mode chosen while read-only replaces the displaced one", () => {
      const { router } = makeModalRouter();

      router.pixelsReadOnly = true;
      router.mode = "select";
      router.pixelsReadOnly = false;

      assert.strictEqual(router.mode, "select");
    });
  });
});
