// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PointerController } from "#src/input/PointerController.ts";
import { Viewport } from "#src/rendering/Viewport.ts";
import { makeActions } from "../helpers/input-actions.ts";
import { makeCanvas } from "../helpers/dom.ts";
import { mouseEvent } from "../helpers/events.ts";
import { FakeFrames } from "../helpers/frames.ts";
import { FakeWindow } from "../helpers/input/window.ts";

function makeOverflowingViewport(): Viewport {
  const viewport = new Viewport({
    textureSize: {
      x: 16,
      y: 16
    },
    zoom: 16
  });
  viewport.updateCanvasSize(200, 200);
  viewport.centerTexture();

  return viewport;
}

describe("PointerController edge pan", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;
  let fakeWindow: FakeWindow;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = makeOverflowingViewport();
    fakeWindow = new FakeWindow();
  });

  function start(
    edgePans = true
  ) {
    const { actions, calls } = makeActions({ edgePans });
    const ctrl = new PointerController({
      canvas,
      viewport,
      actions,
      window: fakeWindow
    });
    canvas.dispatchEvent(mouseEvent("mousedown", 100, 100));

    return { ctrl, calls };
  }

  test("pans each frame while the cursor rests in the edge band, replaying the drag under it", (t) => {
    const frames = new FakeFrames(t);
    const { ctrl, calls } = start();

    canvas.dispatchEvent(mouseEvent("mousemove", 192, 100));
    for (let frame = 0; frame < 4; frame++) {
      frames.run();
    }

    assert.deepStrictEqual(viewport.camera, { x: -21, y: 8 });
    assert.deepStrictEqual(calls.onPointerMove.at(-1), ["primary", 13, 5]);
    ctrl.destroy();
  });

  test("keeps panning past the canvas edge until the texture's far edge clears the band", (t) => {
    const frames = new FakeFrames(t);
    const { ctrl } = start();

    fakeWindow.dispatch("mousemove", mouseEvent("mousemove", 300, 100));
    for (let frame = 0; frame < 4; frame++) {
      frames.run(100);
    }

    assert.deepStrictEqual(viewport.camera, { x: -88, y: 8 });
    ctrl.destroy();
  });

  test("stops once the texture edge is in view, and resumes when the view changes", (t) => {
    const frames = new FakeFrames(t);
    const { ctrl } = start();

    canvas.dispatchEvent(mouseEvent("mousemove", 10, 100));
    for (let frame = 0; frame < 4; frame++) {
      frames.run(100);
    }
    assert.deepStrictEqual(viewport.camera, { x: 32, y: 8 });
    assert.strictEqual(frames.length, 0);

    viewport.applyPan(-50, 0);

    assert.strictEqual(frames.length, 1);
    ctrl.destroy();
  });

  test("does not edge-pan while a middle-drag pans the view", (t) => {
    const frames = new FakeFrames(t);
    const { ctrl } = start();

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 1,
      buttons: 5,
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));
    const move = new MouseEvent("mousemove", {
      buttons: 5,
      clientX: 192,
      clientY: 100,
      bubbles: true
    });
    canvas.dispatchEvent(move);
    fakeWindow.dispatch("mousemove", move);

    assert.strictEqual(frames.length, 0);
    ctrl.destroy();
  });

  test("stops once the cursor leaves the band", (t) => {
    const frames = new FakeFrames(t);
    const { ctrl } = start();

    canvas.dispatchEvent(mouseEvent("mousemove", 192, 100));
    assert.strictEqual(frames.length, 1);
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));

    assert.strictEqual(frames.length, 0);
    ctrl.destroy();
  });

  test("stops when the drag is released", (t) => {
    const frames = new FakeFrames(t);
    const { ctrl } = start();

    canvas.dispatchEvent(mouseEvent("mousemove", 192, 100));
    assert.strictEqual(frames.length, 1);
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { button: 0, bubbles: true })
    );

    assert.strictEqual(frames.length, 0);
    ctrl.destroy();
  });

  test("cancels a running edge pan on destroy", (t) => {
    const frames = new FakeFrames(t);
    const { ctrl } = start();

    canvas.dispatchEvent(mouseEvent("mousemove", 192, 100));
    assert.strictEqual(frames.length, 1);
    ctrl.destroy();

    assert.strictEqual(frames.length, 0);
  });

  test("never starts when the actions do not edge-pan", (t) => {
    const frames = new FakeFrames(t);
    const { ctrl } = start(false);

    canvas.dispatchEvent(mouseEvent("mousemove", 192, 100));

    assert.strictEqual(frames.length, 0);
    ctrl.destroy();
  });

  test("a middle-drag pan during a drag replays the drag at the still cursor", () => {
    const { ctrl, calls } = start(false);

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 1,
      buttons: 5,
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));
    fakeWindow.dispatch("mousemove", mouseEvent("mousemove", 120, 100));

    assert.deepStrictEqual(calls.onPointerMove.at(-1), ["primary", 4, 5]);
    ctrl.destroy();
  });
});
