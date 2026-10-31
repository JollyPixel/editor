// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { KeyBindings } from "@jolly-pixel/controls";
import type { OrbitFlyCameraEvents } from "@jolly-pixel/engine";
import { LogQueue } from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { bindOrbitFocus } from "#src/viewport/index.ts";

function setup() {
  const keyboard = new KeyBindings();
  const log = new LogQueue();
  const events = new Emitter<OrbitFlyCameraEvents>();
  const camera = {
    isOrbiting: false,
    exitOrbitFocus: () => {
      camera.isOrbiting = false;
    },
    subscribe: events.subscribe.bind(events)
  };
  const release = bindOrbitFocus(camera, {
    keyboard,
    log
  });

  return {
    camera,
    events,
    release,
    messages: () => log.entries.map((entry) => String(entry.content)).reverse(),
    pressEscape: () => keyboard.dispatch(
      new KeyboardEvent("keydown", {
        code: "Escape",
        key: "Escape",
        cancelable: true
      })
    )
  };
}

describe("bindOrbitFocus", () => {
  test("Escape leaves the pivot and passes on while the camera flies freely", () => {
    const { camera, pressEscape } = setup();

    assert.equal(pressEscape(), false);

    camera.isOrbiting = true;
    assert.equal(pressEscape(), true);
    assert.equal(camera.isOrbiting, false);
    assert.equal(pressEscape(), false);
  });

  test("logs each switch between pivot and free fly", () => {
    const { events, messages } = setup();

    events.emit("orbit", true);
    events.emit("orbit", false);

    assert.deepEqual(messages(), [
      "Camera switched to pivot",
      "Camera switched to free fly"
    ]);
  });

  test("the release function drops the Escape binding and the log", () => {
    const { camera, events, messages, pressEscape, release } = setup();

    release();
    camera.isOrbiting = true;
    events.emit("orbit", true);

    assert.equal(pressEscape(), false);
    assert.deepEqual(messages(), []);
  });
});
