// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { InteractionRouter } from "#src/input/InteractionRouter.ts";
import { InteractionMode } from "#src/input/modes/InteractionMode.ts";
import type { Viewport } from "#src/rendering/Viewport.ts";
import type { Mode, Vec2 } from "#src/types.ts";

class FakeMode extends InteractionMode {
  readonly id: Mode;
  readonly calls: string[] = [];
  #cursor: string;

  constructor(
    id: Mode,
    cursor = ""
  ) {
    super();
    this.id = id;
    this.#cursor = cursor;
  }

  onEnter(previous: Mode): void {
    this.calls.push(`enter:${previous}`);
  }

  onExit(next: Mode): void {
    this.calls.push(`exit:${next}`);
  }

  cursor(): string {
    return this.#cursor;
  }

  highlightSize(brushSize: number): number {
    return brushSize * 2;
  }

  onPrimaryDown(pos: Vec2): boolean | void {
    this.calls.push(`down:${pos.x},${pos.y}`);

    return true;
  }

  onPrimaryMove(pos: Vec2): void {
    this.calls.push(`move:${pos.x},${pos.y}`);
  }

  onPrimaryUp(): void {
    this.calls.push("up");
  }

  onDelete(): boolean | void {
    this.calls.push("delete");

    return true;
  }
}

interface Recorder {
  pan: [number, number][];
  zoom: [number, number, number][];
  cursor: string[];
}

function makeRouter(
  options: {
    modes?: FakeMode[];
    defaultMode?: Mode;
    onUndo?: () => boolean | void;
    onRedo?: () => boolean | void;
  } = {}
): { router: InteractionRouter; recorder: Recorder; modes: FakeMode[]; } {
  const modes = options.modes ?? [
    new FakeMode("paint"),
    new FakeMode("select", "grab")
  ];
  const recorder: Recorder = {
    pan: [],
    zoom: [],
    cursor: []
  };

  const viewport = {
    applyPan: (dx: number, dy: number) => recorder.pan.push([dx, dy]),
    applyZoom: (delta: number, mx: number, my: number) => recorder.zoom.push([delta, mx, my])
  } as unknown as Viewport;

  const router = new InteractionRouter({
    modes,
    defaultMode: options.defaultMode ?? "paint",
    viewport,
    setCursor: (cursor) => recorder.cursor.push(cursor),
    onUndo: options.onUndo ?? (() => undefined),
    onRedo: options.onRedo ?? (() => undefined)
  });

  return {
    router,
    recorder,
    modes
  };
}

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

  test("forwards pointer actions to the active mode and returns its result", () => {
    const { router, modes } = makeRouter();

    const handled = router.onPrimaryDown(4, 7);
    router.onPrimaryMove(5, 8);
    router.onPrimaryUp();

    assert.strictEqual(handled, true);
    assert.deepStrictEqual(
      modes[0].calls,
      ["down:4,7", "move:5,8", "up"]
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

  test("re-syncs the cursor after a primary press/release and on blur", () => {
    const { router, recorder } = makeRouter({
      modes: [new FakeMode("select", "grab")],
      defaultMode: "select"
    });

    router.onPrimaryDown(1, 1);
    router.onPrimaryUp();
    router.onBlur();

    assert.deepStrictEqual(
      recorder.cursor,
      ["grab", "grab", "grab"]
    );
  });

  test("routes edit actions to the active mode", () => {
    const { router, modes } = makeRouter({
      modes: [new FakeMode("select")],
      defaultMode: "select"
    });

    const handled = router.onDelete();

    assert.strictEqual(handled, true);
    assert.deepStrictEqual(modes[0].calls, ["delete"]);
  });

  test("handles pan and zoom itself, never touching the active mode", () => {
    const { router, recorder, modes } = makeRouter();

    router.onPanMove(3, -4);
    router.onZoom(120, 10, 20);

    assert.deepStrictEqual(recorder.pan, [[3, -4]]);
    assert.deepStrictEqual(recorder.zoom, [[120, 10, 20]]);
    assert.deepStrictEqual(modes[0].calls, []);
  });

  test("a pan gesture shows grabbing, then restores the mode cursor on end", () => {
    const { router, recorder } = makeRouter({
      modes: [new FakeMode("paint", "crosshair")],
      defaultMode: "paint"
    });

    router.onPanStart(0, 0);
    router.onPanEnd();

    assert.deepStrictEqual(recorder.cursor, ["grabbing", "crosshair"]);
  });

  test("Space arms a grab cursor and a pan restores to grab while it stays held", () => {
    const { router, recorder } = makeRouter({
      modes: [new FakeMode("paint", "crosshair")],
      defaultMode: "paint"
    });

    router.onSpaceDown();
    router.onPanStart(0, 0);
    router.onPanEnd();
    router.onSpaceUp();

    assert.deepStrictEqual(
      recorder.cursor,
      ["grab", "grabbing", "grab", "crosshair"]
    );
  });

  test("delegates undo/redo to the injected callbacks", () => {
    let undo = 0;
    let redo = 0;
    const { router } = makeRouter({
      onUndo: () => {
        undo++;

        return true;
      },
      onRedo: () => {
        redo++;

        return false;
      }
    });

    assert.strictEqual(router.onUndo(), true);
    assert.strictEqual(router.onRedo(), false);
    assert.strictEqual(undo, 1);
    assert.strictEqual(redo, 1);
  });

  test("highlightBrushSize delegates to the active mode", () => {
    const { router } = makeRouter();

    assert.strictEqual(router.highlightBrushSize(5), 10);
  });
});
