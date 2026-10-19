// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Mouse } from "../../../src/index.ts";
import { MouseEventButton } from "../../../src/devices/mouse/Mouse.class.ts";
import {
  createConnectedMouseFixture,
  MouseCanvasAdapter,
  MouseDocumentAdapter
} from "./Mouse.fixture.ts";
import { createTouch } from "../../mocks/index.ts";

describe("Controls.Mouse motion", () => {
  let mouse: Mouse;
  let canvas: MouseCanvasAdapter;
  let documentAdapter: MouseDocumentAdapter;

  beforeEach(() => {
    ({
      mouse,
      canvas,
      documentAdapter
    } = createConnectedMouseFixture());
  });

  afterEach(() => {
    mouse.disconnect();
  });

  test("isMoving reflects the current delta", () => {
    assert.strictEqual(mouse.isMoving(), false);

    canvas.dispatchMouseEvent("mousemove", { clientX: 10, clientY: 0 });
    mouse.update();

    assert.strictEqual(mouse.isMoving(), true);
  });

  test("viewportPosition normalizes canvas-space coordinates into [-1, 1] with Y flipped", () => {
    canvas.dispatchMouseEvent("mousemove", { clientX: 800, clientY: 0 });
    mouse.update();

    assert.deepStrictEqual(
      mouse.viewportPosition,
      { x: 1, y: 1 }
    );
  });

  test("worldPosition scales the viewport position by half the canvas size", () => {
    canvas.dispatchMouseEvent("mousemove", { clientX: 800, clientY: 0 });
    mouse.update();

    assert.deepStrictEqual(
      mouse.worldPosition,
      { x: 400, y: 300 }
    );
  });

  test("viewportDelta inverts Y, and normalizes against canvas size when requested", () => {
    canvas.dispatchMouseEvent("mousemove", { clientX: 10, clientY: 20 });
    mouse.update();

    assert.deepStrictEqual(
      mouse.viewportDelta(),
      { x: 10, y: -20 }
    );
    assert.deepStrictEqual(
      mouse.viewportDelta(true),
      { x: 0.025, y: -20 / 300 }
    );
  });

  test("should handle mouse move event without pointer lock", () => {
    const moveEvents: MouseEvent[] = [];
    mouse.on("move", (event) => {
      moveEvents.push(event);
    });

    canvas.dispatchMouseEvent(
      "mousemove",
      { clientX: 150, clientY: 200 }
    );

    mouse.update();

    assert.strictEqual(moveEvents.length, 1);
    assert.deepStrictEqual(mouse.position, { x: 150, y: 200 });
  });

  test("should calculate position delta correctly", () => {
    canvas.dispatchMouseEvent("mousemove", { clientX: 100, clientY: 150 });
    mouse.update();

    assert.deepStrictEqual(mouse.position, { x: 100, y: 150 });
    assert.deepStrictEqual(mouse.delta, { x: 100, y: 150 });

    canvas.dispatchMouseEvent("mousemove", { clientX: 120, clientY: 160 });
    mouse.update();

    assert.deepStrictEqual(mouse.position, { x: 120, y: 160 });
    assert.deepStrictEqual(mouse.delta, { x: 20, y: 10 });
  });

  test("should reset delta when no new position", () => {
    canvas.dispatchMouseEvent("mousemove", { clientX: 100, clientY: 150 });
    mouse.update();

    mouse.update();

    assert.deepStrictEqual(mouse.delta, { x: 0, y: 0 });
  });

  test("the first touch drives the left button and the position", () => {
    const touch = createTouch(4096, 100, 150);

    canvas.dispatchTouchEvent("touchstart", [touch]);
    mouse.update();
    assert.strictEqual(mouse.wasJustPressed("left"), true);
    assert.deepStrictEqual(mouse.position, { x: 100, y: 150 });

    canvas.dispatchTouchEvent("touchmove", [createTouch(4096, 120, 160)]);
    mouse.update();
    assert.deepStrictEqual(mouse.delta, { x: 20, y: 10 });

    canvas.dispatchTouchEvent("touchend", [touch]);
    mouse.update();
    assert.strictEqual(mouse.wasJustReleased("left"), true);
  });

  test("a second touch leaves the mouse alone", () => {
    canvas.dispatchTouchEvent("touchstart", [createTouch(1, 100, 150)]);
    mouse.update();

    canvas.dispatchTouchEvent("touchstart", [createTouch(2, 300, 300)]);
    canvas.dispatchTouchEvent("touchmove", [createTouch(2, 310, 310)]);
    canvas.dispatchTouchEvent("touchend", [createTouch(2, 310, 310)]);
    mouse.update();

    assert.strictEqual(mouse.isDown("left"), true);
    assert.deepStrictEqual(mouse.position, { x: 100, y: 150 });
  });

  test("keeps tracking a drag once the cursor leaves the canvas", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.middle });
    mouse.update();

    documentAdapter.dispatchMouseEvent("mousemove", {
      clientX: 40,
      clientY: 20
    });
    mouse.update();

    assert.deepStrictEqual(mouse.position, { x: 40, y: 20 });
    assert.deepStrictEqual(mouse.delta, { x: 40, y: 20 });
  });

  test("ignores movement away from the canvas while no button is held", () => {
    documentAdapter.dispatchMouseEvent("mousemove", {
      clientX: 40,
      clientY: 20
    });
    mouse.update();

    assert.deepStrictEqual(mouse.position, { x: 0, y: 0 });
    assert.strictEqual(mouse.isMoving(), false);
  });

  test("should calculate position relative to canvas offset", () => {
    canvas.rect = { left: 100, top: 50 };

    canvas.dispatchMouseEvent("mousemove", { clientX: 250, clientY: 200 });
    mouse.update();

    assert.deepStrictEqual(mouse.position, { x: 150, y: 150 });
  });

  test("does not force a layout read when the event exposes offsetX/offsetY", () => {
    canvas.rect = { left: 100, top: 50 };
    canvas.boundingClientRectCalls = 0;

    for (let i = 0; i < 50; i++) {
      canvas.dispatchMouseEvent("mousemove", { clientX: 250, clientY: 200 });
    }

    mouse.update();

    assert.strictEqual(canvas.boundingClientRectCalls, 0);
    assert.deepStrictEqual(mouse.position, { x: 150, y: 150 });
  });

  test("falls back to getBoundingClientRect() when offsets are unavailable", () => {
    canvas.rect = { left: 100, top: 50 };
    canvas.boundingClientRectCalls = 0;

    canvas.dispatchMouseEvent("mousemove", {
      clientX: 250,
      clientY: 200,
      omitOffsets: true
    });

    mouse.update();

    assert.strictEqual(canvas.boundingClientRectCalls, 1);
    assert.deepStrictEqual(mouse.position, { x: 150, y: 150 });
  });

  test("movement arriving after idle ticks still updates position and delta", () => {
    for (let frame = 0; frame < 20; frame++) {
      mouse.update();
    }

    canvas.dispatchMouseEvent("mousemove", { clientX: 42, clientY: 24 });
    mouse.update();

    assert.deepStrictEqual(mouse.position, { x: 42, y: 24 });
    assert.strictEqual(mouse.isMoving(), true);

    mouse.update();
    assert.strictEqual(mouse.isMoving(), false);
  });

  test("is not hovering until the pointer reaches the canvas", () => {
    assert.strictEqual(mouse.hovering, false);

    canvas.dispatch("mouseenter", {});

    assert.strictEqual(mouse.hovering, true);
  });

  test("stops hovering once the pointer leaves the canvas", () => {
    canvas.dispatch("mouseenter", {});
    canvas.dispatch("mouseleave", {});

    assert.strictEqual(mouse.hovering, false);
  });

  test("emits enter and leave only when hovering changes", () => {
    const events: string[] = [];
    mouse.on("enter", () => events.push("enter"));
    mouse.on("leave", () => events.push("leave"));

    canvas.dispatch("mouseenter", {});
    canvas.dispatch("mouseenter", {});
    canvas.dispatch("mouseleave", {});
    canvas.dispatch("mouseleave", {});

    assert.deepStrictEqual(events, ["enter", "leave"]);
  });

  test("hovers again on a canvas move that follows a missed enter", () => {
    canvas.dispatchMouseEvent("mousemove", { clientX: 10, clientY: 10 });

    assert.strictEqual(mouse.hovering, true);
  });

  test("reset stops hovering, as the window losing focus does", () => {
    canvas.dispatch("mouseenter", {});

    mouse.reset();

    assert.strictEqual(mouse.hovering, false);
  });

  test("keeps hovering while the first touch holds the canvas", () => {
    const touch = createTouch(0, 100, 150);

    canvas.dispatchTouchEvent("touchstart", [touch]);
    assert.strictEqual(mouse.hovering, true);

    canvas.dispatchTouchEvent("touchend", [touch]);
    assert.strictEqual(mouse.hovering, false);
  });
});
