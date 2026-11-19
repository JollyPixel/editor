// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import { StepperController } from "../../../src/interaction/stepper/StepperController.ts";

// CONSTANTS
const kMounted: HTMLElement[] = [];

interface MountedStepper {
  controller: StepperController;
  up: HTMLElement;
  down: HTMLElement;
  inputs: number[];
  commits: number[];
}

function pointer(
  type: string,
  init: PointerEventInit = {}
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    button: 0,
    pointerId: 1,
    ...init
  });
}

function mountStepper(
  value: number,
  max = Number.POSITIVE_INFINITY
): MountedStepper {
  const host = Object.assign(document.createElement("div"), {
    addController: () => undefined
  }) as unknown as ReactiveControllerHost & HTMLElement;
  const up = document.createElement("span");
  const down = document.createElement("span");
  host.append(up, down);
  document.body.append(host);
  kMounted.push(host);

  const inputs: number[] = [];
  const commits: number[] = [];
  const controller = new StepperController(host, {
    start: () => value,
    next: (current, direction, modifiers) => Math.min(
      current + (direction * (modifiers.shiftKey ? 10 : 1)),
      max
    ),
    onInput: (next) => inputs.push(next),
    onCommit: (next) => commits.push(next)
  });
  up.addEventListener("pointerdown", controller.onIncrementPress);
  down.addEventListener("pointerdown", controller.onDecrementPress);

  return {
    controller,
    up,
    down,
    inputs,
    commits
  };
}

describe("StepperController", () => {
  afterEach(() => {
    for (const host of kMounted.splice(0)) {
      host.remove();
    }
  });

  test("a click previews one step and commits it on release", () => {
    const { up, down, inputs, commits } = mountStepper(5);

    up.dispatchEvent(pointer("pointerdown"));
    up.dispatchEvent(pointer("pointerup"));
    down.dispatchEvent(pointer("pointerdown", { shiftKey: true }));
    down.dispatchEvent(pointer("pointerup"));

    assert.deepEqual(inputs, [6, -5]);
    assert.deepEqual(commits, [6, -5]);
  });

  test("holding repeats after a delay and commits once", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    const { controller, up, inputs, commits } = mountStepper(0);

    up.dispatchEvent(pointer("pointerdown"));
    t.mock.timers.tick(399);
    assert.deepEqual(inputs, [1]);
    assert.equal(controller.dragging, true);

    for (const ms of [1, 60, 60]) {
      t.mock.timers.tick(ms);
    }
    up.dispatchEvent(pointer("pointerup"));
    t.mock.timers.tick(60);

    assert.deepEqual(inputs, [1, 2, 3]);
    assert.deepEqual(commits, [3]);
    assert.equal(controller.dragging, false);
  });

  test("a hold stops streaming at the bound", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    const { up, inputs, commits } = mountStepper(0, 2);

    up.dispatchEvent(pointer("pointerdown"));
    for (const ms of [400, 60, 60, 60, 60]) {
      t.mock.timers.tick(ms);
    }
    up.dispatchEvent(pointer("pointerup"));

    assert.deepEqual(inputs, [1, 2]);
    assert.deepEqual(commits, [2]);
  });

  test("a cancelled hold restores the origin and commits nothing", () => {
    const { up, inputs, commits } = mountStepper(5);

    up.dispatchEvent(pointer("pointerdown"));
    up.dispatchEvent(pointer("pointercancel"));

    assert.deepEqual(inputs, [6, 5]);
    assert.deepEqual(commits, []);
  });

  test("a press at the bound commits nothing", () => {
    const { up, inputs, commits } = mountStepper(2, 2);

    up.dispatchEvent(pointer("pointerdown"));
    up.dispatchEvent(pointer("pointerup"));

    assert.deepEqual(inputs, []);
    assert.deepEqual(commits, []);
  });
});
