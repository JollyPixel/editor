// Import Node.js Dependencies
import assert from "node:assert/strict";
import { test } from "node:test";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import {
  ScrubController,
  type ScrubOptions
} from "../../../src/interaction/scrub/ScrubController.ts";

interface MountedScrub {
  controller: ScrubController;
  target: HTMLElement;
  inputs: number[];
  commits: number[];
  unmount(): void;
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

function mountScrub(
  options: Omit<ScrubOptions, "target" | "onInput" | "onCommit">
): MountedScrub {
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
    ...options,
    target: () => target,
    onInput: (value) => inputs.push(value),
    onCommit: (value) => commits.push(value)
  });
  controller.hostConnected();

  return {
    controller,
    target,
    inputs,
    commits,
    unmount() {
      controller.hostDisconnected();
      host.remove();
    }
  };
}

test("ScrubController restores the preview and does not commit on cancel", () => {
  const { controller, target, inputs, commits, unmount } = mountScrub({
    start: () => 10,
    step: () => 1
  });

  target.dispatchEvent(pointer("pointerdown", 0));
  target.dispatchEvent(pointer("pointermove", 20));
  target.dispatchEvent(pointer("pointercancel", 20));

  assert.deepEqual(inputs, [15, 10]);
  assert.deepEqual(commits, []);
  assert.equal(controller.dragging, false);
  assert.equal(target.hasPointerCapture(1), false);
  assert.equal(document.querySelector(".jolly-scrub-guide"), null);

  unmount();
});

test("ScrubController rounds to the precision of each drag start and step", () => {
  let start = 1.25;
  let step = 0.05;
  const { target, inputs, commits, unmount } = mountScrub({
    start: () => start,
    step: () => step
  });

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

  unmount();
});

test("ScrubController treats a press released under the threshold as a click", () => {
  let clicks = 0;
  const { target, inputs, commits, unmount } = mountScrub({
    start: () => 10,
    step: () => 1,
    threshold: 3,
    onClick: () => clicks++
  });

  target.dispatchEvent(pointer("pointerdown", 0));
  target.dispatchEvent(pointer("pointermove", 2));
  target.dispatchEvent(pointer("pointerup", 2));

  target.dispatchEvent(pointer("pointerdown", 0));
  target.dispatchEvent(pointer("pointermove", 8));
  target.dispatchEvent(pointer("pointerup", 8));

  assert.equal(clicks, 1);
  assert.deepEqual(inputs, [12]);
  assert.deepEqual(commits, [12]);

  unmount();
});

test("ScrubController previews a jump at once and a cancel restores the value before it", () => {
  let clicks = 0;
  const { target, inputs, commits, unmount } = mountScrub({
    start: () => 10,
    step: () => 1,
    threshold: 3,
    pixelsPerStep: () => 2,
    jump: () => 40,
    onClick: () => clicks++
  });

  target.dispatchEvent(pointer("pointerdown", 0));
  target.dispatchEvent(pointer("pointerup", 0));

  target.dispatchEvent(pointer("pointerdown", 0));
  target.dispatchEvent(pointer("pointermove", 6));
  target.dispatchEvent(pointer("pointercancel", 6));

  assert.equal(clicks, 0);
  assert.deepEqual(inputs, [40, 40, 43, 10]);
  assert.deepEqual(commits, [40]);

  unmount();
});
