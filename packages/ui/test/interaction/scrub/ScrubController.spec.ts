// Import Node.js Dependencies
import assert from "node:assert/strict";
import { test } from "node:test";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import { ScrubController } from "../../../src/interaction/scrub/ScrubController.ts";

interface CaptureElement extends HTMLElement {
  captured: number | null;
}

function pointer(
  type: string,
  clientX: number
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    button: 0,
    pointerId: 1,
    clientX
  });
}

test("ScrubController restores the preview and does not commit on cancel", () => {
  const hostElement = document.createElement("div");
  const host = Object.assign(hostElement, {
    addController: () => undefined
  }) as unknown as ReactiveControllerHost & HTMLElement;
  const target = Object.assign(document.createElement("span"), {
    captured: null as number | null
  }) as CaptureElement;
  target.setPointerCapture = (pointerId) => {
    target.captured = pointerId;
  };
  target.hasPointerCapture = (pointerId) => target.captured === pointerId;
  target.releasePointerCapture = () => {
    target.captured = null;
  };
  host.append(target);
  document.body.append(host);

  const inputs: number[] = [];
  const commits: number[] = [];
  const controller = new ScrubController(host, {
    target: () => target,
    start: () => 10,
    step: () => 1,
    onInput: (value) => inputs.push(value),
    onCommit: (value) => commits.push(value)
  });
  controller.hostConnected();

  target.dispatchEvent(pointer("pointerdown", 0));
  target.dispatchEvent(pointer("pointermove", 20));
  target.dispatchEvent(pointer("pointercancel", 20));

  assert.deepEqual(inputs, [15, 10]);
  assert.deepEqual(commits, []);
  assert.equal(controller.dragging, false);
  assert.equal(target.captured, null);
  assert.equal(document.querySelector(".jolly-scrub-guide"), null);

  controller.hostDisconnected();
  host.remove();
});
