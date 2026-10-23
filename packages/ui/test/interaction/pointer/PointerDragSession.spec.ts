// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  startPointerDragSession,
  type PointerDragResult
} from "../../../src/interaction/pointer/PointerDragSession.ts";

function pointer(
  type: string,
  pointerId: number,
  clientX = 0,
  clientY = 0
): PointerEvent {
  return new PointerEvent(type, {
    pointerId,
    clientX,
    clientY
  });
}

describe("PointerDragSession", () => {
  test("captures immediately but starts only after the threshold", () => {
    const element = document.createElement("div");
    let starts = 0;
    const moves: number[][] = [];
    const finishes: Array<[PointerDragResult, boolean]> = [];
    startPointerDragSession({
      element,
      event: pointer("pointerdown", 7, 10, 10),
      threshold: 4,
      elementAttribute: "data-dragging",
      onStart: () => {
        starts += 1;
      },
      onMove: (x, y) => moves.push([x, y]),
      onFinish: (result, started) => finishes.push([result, started])
    });

    assert.equal(element.hasPointerCapture(7), true);
    element.dispatchEvent(pointer("pointermove", 8, 30, 30));
    element.dispatchEvent(pointer("pointermove", 7, 12, 12));
    assert.equal(starts, 0);
    assert.equal(element.hasAttribute("data-dragging"), false);

    element.dispatchEvent(pointer("pointermove", 7, 14, 10));
    assert.equal(starts, 1);
    assert.equal(element.hasAttribute("data-dragging"), true);
    assert.deepEqual(moves, [[14, 10]]);
    element.dispatchEvent(pointer("pointerup", 7, 14, 10));
    assert.deepEqual(finishes, [["commit", true]]);
    assert.equal(element.hasPointerCapture(7), false);
    assert.equal(element.hasAttribute("data-dragging"), false);
  });

  test("reports a release below the threshold without starting", () => {
    const element = document.createElement("div");
    const finishes: Array<[PointerDragResult, boolean]> = [];
    startPointerDragSession({
      element,
      event: pointer("pointerdown", 2),
      threshold: 4,
      onMove: () => undefined,
      onFinish: (result, started) => finishes.push([result, started])
    });

    element.dispatchEvent(pointer("pointerup", 2, 1, 1));
    assert.deepEqual(finishes, [["commit", false]]);
  });

  test("suppressClick swallows the release click of a started drag only", () => {
    const element = document.createElement("button");
    document.body.append(element);
    const clicks: number[] = [];
    element.addEventListener("click", (event) => clicks.push(event.detail));

    for (const [pointerId, upX] of [[5, 20], [6, 1]]) {
      startPointerDragSession({
        element,
        event: pointer("pointerdown", pointerId),
        threshold: 4,
        suppressClick: true,
        onMove: () => undefined,
        onFinish: () => undefined
      });
      element.dispatchEvent(pointer("pointermove", pointerId, upX, 0));
      element.dispatchEvent(pointer("pointerup", pointerId, upX, 0));
      element.dispatchEvent(new PointerEvent("click", {
        bubbles: true,
        detail: 1
      }));
    }
    element.dispatchEvent(new PointerEvent("click", {
      bubbles: true,
      detail: 2
    }));
    element.remove();

    assert.deepEqual(clicks, [1, 2]);
  });

  test("cancels once when capture is lost", () => {
    const element = document.createElement("div");
    const finishes: PointerDragResult[] = [];
    const session = startPointerDragSession({
      element,
      event: pointer("pointerdown", 3),
      onMove: () => undefined,
      onFinish: (result) => finishes.push(result)
    });

    element.dispatchEvent(pointer("lostpointercapture", 3));
    session.cancel();
    element.dispatchEvent(pointer("pointerup", 3));
    assert.deepEqual(finishes, ["cancel"]);
  });

  test("Escape and the owner handle cancel explicitly", () => {
    for (const settle of ["escape", "handle"] as const) {
      const element = document.createElement("div");
      const finishes: PointerDragResult[] = [];
      const session = startPointerDragSession({
        element,
        event: pointer("pointerdown", 4),
        onMove: () => undefined,
        onFinish: (result) => finishes.push(result)
      });

      if (settle === "escape") {
        document.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Escape"
        }));
      }
      else {
        session.cancel();
      }
      assert.deepEqual(finishes, ["cancel"]);
    }
  });
});
