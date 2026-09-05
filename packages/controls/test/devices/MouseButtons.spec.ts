// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Mouse } from "../../src/index.ts";
import { MouseEventButton } from "../../src/devices/Mouse.class.ts";
import {
  createConnectedMouseFixture,
  MouseCanvasAdapter,
  MouseDocumentAdapter
} from "./Mouse.fixture.ts";

describe("Controls.Mouse buttons", () => {
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

  test("isDown resolves a named button, and handles ANY / NONE", () => {
    assert.strictEqual(mouse.isDown("left"), false);
    assert.strictEqual(mouse.isDown("NONE"), true);
    assert.strictEqual(mouse.isDown("ANY"), false);

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });

    assert.strictEqual(mouse.isDown("left"), true);
    assert.strictEqual(mouse.isDown(MouseEventButton.left), true);
    assert.strictEqual(mouse.isDown("ANY"), true);
    assert.strictEqual(mouse.isDown("NONE"), false);
  });

  test("wasJustPressed / wasJustReleased resolve a named button, and handle ANY / NONE", () => {
    assert.strictEqual(mouse.wasJustPressed("NONE"), true);

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    mouse.update();
    assert.strictEqual(mouse.wasJustPressed("left"), true);
    assert.strictEqual(mouse.wasJustPressed("ANY"), true);
    assert.strictEqual(mouse.wasJustPressed("NONE"), false);

    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });
    mouse.update();
    assert.strictEqual(mouse.wasJustReleased("left"), true);
  });

  test("preserves a complete click that occurs between input samples", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });

    mouse.update();

    assert.strictEqual(mouse.wasJustPressed("left"), true);
    assert.strictEqual(mouse.wasJustReleased("left"), true);

    mouse.update();

    assert.strictEqual(mouse.wasJustPressed("left"), false);
    assert.strictEqual(mouse.wasJustReleased("left"), false);

    mouse.publishFrameState();

    assert.strictEqual(mouse.wasJustPressed("left"), true);
    assert.strictEqual(mouse.wasJustReleased("left"), true);

    mouse.publishFrameState();

    assert.strictEqual(mouse.wasJustPressed("left"), false);
    assert.strictEqual(mouse.wasJustReleased("left"), false);
  });

  test("publishes transitions accumulated across several input samples", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    mouse.update();
    mouse.update();

    assert.strictEqual(mouse.wasJustPressed("left"), false);

    mouse.publishFrameState();

    assert.strictEqual(mouse.wasJustPressed("left"), true);
  });

  test("should handle mouse down event", () => {
    const downEvents: MouseEvent[] = [];
    mouse.on("down", (event) => {
      downEvents.push(event);
    });

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });

    assert.strictEqual(downEvents.length, 1);
    assert.strictEqual(mouse.isDown(MouseEventButton.left), true);
    assert.strictEqual(canvas.focus.mock.calls.length, 1);
  });

  test("should handle mouse up event", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });

    const upEvents: MouseEvent[] = [];
    mouse.on("up", (event) => {
      upEvents.push(event);
    });

    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });

    assert.strictEqual(upEvents.length, 1);
    assert.strictEqual(mouse.isDown(MouseEventButton.left), false);
  });

  test("should handle double click event", () => {
    canvas.dispatchMouseEvent("dblclick", { button: MouseEventButton.left });
    mouse.update();

    assert.strictEqual(
      mouse.buttonState(MouseEventButton.left).doubleClicked,
      true
    );
  });

  test("doubleClicked is a one-frame pulse, not a permanent latch", () => {
    canvas.dispatchMouseEvent("dblclick", { button: MouseEventButton.left });
    mouse.update();
    assert.strictEqual(
      mouse.buttonState(MouseEventButton.left).doubleClicked,
      true
    );

    mouse.update();

    assert.strictEqual(
      mouse.buttonState(MouseEventButton.left).doubleClicked,
      false
    );
  });

  test("should update button states correctly", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    mouse.update();

    assert.strictEqual(mouse.buttonState(MouseEventButton.left).isDown, true);
    assert.strictEqual(
      mouse.buttonState(MouseEventButton.left).wasJustPressed,
      true
    );
    assert.strictEqual(mouse.wasActive, true);

    mouse.update();

    assert.strictEqual(
      mouse.buttonState(MouseEventButton.left).wasJustPressed,
      false
    );
    assert.strictEqual(mouse.buttonState(MouseEventButton.left).isDown, true);

    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });
    mouse.update();

    assert.strictEqual(mouse.buttonState(MouseEventButton.left).isDown, false);
    assert.strictEqual(
      mouse.buttonState(MouseEventButton.left).wasJustReleased,
      true
    );
  });

  test("tracks a button index outside the seven known ones as not pressed", () => {
    canvas.dispatchMouseEvent("mousedown", { button: 9 });
    mouse.update();

    assert.strictEqual(mouse.isDown(9), false);
    assert.strictEqual(mouse.isDown("ANY"), false);
  });

  test("should handle multiple buttons pressed simultaneously", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.right });
    mouse.update();

    assert.strictEqual(mouse.buttonState(MouseEventButton.left).isDown, true);
    assert.strictEqual(mouse.buttonState(MouseEventButton.right).isDown, true);
  });

  test("releases a button let go of outside the canvas", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.middle });
    mouse.update();

    assert.strictEqual(mouse.isDown("middle"), true);

    documentAdapter.dispatchMouseEvent("mouseup", {
      button: MouseEventButton.middle
    });
    mouse.update();

    assert.strictEqual(mouse.isDown("middle"), false);
    assert.strictEqual(mouse.wasJustReleased("middle"), true);
  });

  test("handles a canvas event once, however far it bubbles", () => {
    const events: string[] = [];
    mouse.on("up", () => events.push("up"));

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    const event = canvas.dispatchMouseEvent("mouseup", {
      button: MouseEventButton.left
    });
    documentAdapter.replay("mouseup", event);

    assert.deepStrictEqual(events, ["up"]);
  });

  test("a full press/release cycle still publishes every transition", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    mouse.update();
    assert.strictEqual(mouse.isDown("left"), true);
    assert.strictEqual(mouse.wasJustPressed("left"), true);

    mouse.update();
    assert.strictEqual(mouse.wasJustPressed("left"), false);

    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });
    mouse.update();
    assert.strictEqual(mouse.wasJustReleased("left"), true);

    // The settling tick must run even though nothing is held.
    mouse.update();
    assert.strictEqual(mouse.wasJustReleased("left"), false);
    assert.strictEqual(mouse.wasActive, false);
  });
});
