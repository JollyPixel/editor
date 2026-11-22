// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { KeyBindings } from "@jolly-pixel/controls";

// Import Internal Dependencies
import { bindOrbitFocus } from "../../../src/components/index.ts";

function escapeKeydown(): KeyboardEvent {
  const event = Object.assign(
    new Event("keydown", { cancelable: true }),
    {
      code: "Escape",
      key: "Escape",
      repeat: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false
    }
  );

  return event as unknown as KeyboardEvent;
}

function setup() {
  const keyboard = new KeyBindings();
  const camera = {
    isOrbiting: false,
    exitOrbitFocus: () => {
      camera.isOrbiting = false;
    }
  };
  const release = bindOrbitFocus(camera, keyboard);

  return {
    camera,
    release,
    pressEscape: () => keyboard.dispatch(escapeKeydown())
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

  test("the release function drops the Escape binding", () => {
    const { camera, pressEscape, release } = setup();

    release();
    camera.isOrbiting = true;

    assert.equal(pressEscape(), false);
    assert.equal(camera.isOrbiting, true);
  });
});
