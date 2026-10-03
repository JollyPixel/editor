// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import {
  GameLoop,
  ManualFrameSource
} from "@jolly-pixel/loop";

// Import Internal Dependencies
import {
  GamepadActivity,
  type GamepadActivityView
} from "../../src/session/GamepadActivity.ts";

class FakeView extends EventTarget implements GamepadActivityView {
  #frames = new Map<number, FrameRequestCallback>();
  #nextId = 1;

  get pending(): number {
    return this.#frames.size;
  }

  requestAnimationFrame(
    callback: FrameRequestCallback
  ): number {
    const id = this.#nextId++;
    this.#frames.set(id, callback);

    return id;
  }

  cancelAnimationFrame(
    id: number
  ): void {
    this.#frames.delete(id);
  }

  flush(): void {
    const frames = [...this.#frames.values()];
    this.#frames.clear();
    for (const callback of frames) {
      callback(0);
    }
  }
}

class FakeGamepad {
  connectedGamepads = 1;
  held = false;
  samples = 0;
  wasActive = false;

  sample(): void {
    this.samples++;
    this.wasActive = this.held;
  }
}

function setup() {
  const source = new ManualFrameSource();
  const view = new FakeView();
  const gamepad = new FakeGamepad();
  const loop = new GameLoop({
    source,
    keepAlive: () => gamepad.held,
    trailingRenders: 0
  });
  const activity = new GamepadActivity(
    gamepad,
    loop,
    view,
    () => loop.invalidate()
  );
  const wakes: number[] = [];
  loop.on("wake", () => wakes.push(gamepad.samples));
  loop.start({});

  return {
    source,
    loop,
    view,
    gamepad,
    activity,
    wakes
  };
}

describe("GamepadActivity", () => {
  test("polls a connected gamepad while asleep and wakes once it is held", () => {
    const { loop, view, gamepad, wakes } = setup();
    assert.equal(loop.sleeping, true);

    view.flush();
    view.flush();
    assert.equal(gamepad.samples, 2);
    assert.deepEqual(wakes, []);

    gamepad.held = true;
    view.flush();
    assert.deepEqual(wakes, [3]);
    assert.equal(loop.sleeping, false);
    assert.equal(view.pending, 0);
  });

  test("does not poll while no gamepad is connected", () => {
    const { view, gamepad } = setup();
    gamepad.connectedGamepads = 0;

    view.flush();
    assert.equal(gamepad.samples, 0);
    assert.equal(view.pending, 0);
  });

  test("wakes the loop when a gamepad connects", () => {
    const { view, gamepad, wakes } = setup();
    gamepad.connectedGamepads = 0;
    view.flush();

    view.dispatchEvent(new Event("gamepadconnected"));
    assert.deepEqual(wakes, [0]);
  });

  test("polls only while the loop sleeps", () => {
    const { loop, source, view, gamepad } = setup();

    gamepad.held = true;
    loop.invalidate();
    assert.equal(view.pending, 0);

    gamepad.held = false;
    source.step(16);
    assert.equal(loop.sleeping, true);
    assert.equal(view.pending, 1);
  });

  test("stops polling once the loop stops", () => {
    const { loop, view } = setup();

    loop.stop();
    assert.equal(view.pending, 0);
  });

  test("stops polling and listening once disposed", () => {
    const { view, activity, wakes } = setup();

    activity.dispose();
    assert.equal(view.pending, 0);

    view.dispatchEvent(new Event("gamepadconnected"));
    assert.deepEqual(wakes, []);
  });
});
