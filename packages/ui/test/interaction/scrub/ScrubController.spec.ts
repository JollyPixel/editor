// Import Node.js Dependencies
import assert from "node:assert/strict";
import { test } from "node:test";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import { ScrubController } from "../../../src/interaction/scrub/ScrubController.ts";

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
  const target = document.createElement("span");
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
  assert.equal(target.hasPointerCapture(1), false);
  assert.equal(document.querySelector(".jolly-scrub-guide"), null);

  controller.hostDisconnected();
  host.remove();
});

test("ScrubController rounds to the precision of each drag start and step", () => {
  const hostElement = document.createElement("div");
  const host = Object.assign(hostElement, {
    addController: () => undefined
  }) as unknown as ReactiveControllerHost & HTMLElement;
  const target = document.createElement("span");
  host.append(target);
  document.body.append(host);

  let start = 1.25;
  let step = 0.05;
  const inputs: number[] = [];
  const commits: number[] = [];
  const controller = new ScrubController(host, {
    target: () => target,
    start: () => start,
    step: () => step,
    onInput: (value) => inputs.push(value),
    onCommit: (value) => commits.push(value)
  });
  controller.hostConnected();

  target.dispatchEvent(pointer("pointerdown", 0));
  target.dispatchEvent(pointer("pointermove", 8));
  step = 0.001;
  target.dispatchEvent(pointer("pointermove", 4));
  target.dispatchEvent(pointer("pointerup", 4));

  start = 0.1234;
  target.dispatchEvent(pointer("pointerdown", 0));
  target.dispatchEvent(pointer("pointermove", 4));
  target.dispatchEvent(pointer("pointerup", 4));

  assert.deepEqual(inputs, [1.35, 1.251, 0.1244]);
  assert.deepEqual(commits, [1.251, 0.1244]);

  controller.hostDisconnected();
  host.remove();
});
