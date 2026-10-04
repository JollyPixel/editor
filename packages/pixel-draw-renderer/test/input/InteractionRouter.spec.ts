// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Mode } from "#src/types.ts";
import { makeRouter } from "../helpers/input/router.ts";

describe("InteractionRouter", () => {
  test("starts on the default mode without an onEnter or cursor sync", () => {
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

  test("switching mode runs the leaving onExit then the entering onEnter, then syncs the cursor", () => {
    const { router, recorder, modes } = makeRouter();

    router.mode = "select";

    assert.strictEqual(router.mode, "select");
    assert.deepStrictEqual(modes[0].calls, ["exit:select"]);
    assert.deepStrictEqual(modes[1].calls, ["enter:paint"]);
    assert.deepStrictEqual(recorder.cursor, ["grab"]);
  });

  test("setting the current mode again is a no-op (no exit/enter/cursor)", () => {
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
});
