// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Input,
  MouseEventButton
} from "../src/index.ts";
import type { CanvasAdapter } from "../src/adapters/index.ts";
import * as mocks from "./mocks/index.ts";

function createFakeCanvas(): CanvasAdapter {
  return {
    clientWidth: 800,
    clientHeight: 600,
    style: {
      cursor: "auto"
    },
    addEventListener: mock.fn(),
    removeEventListener: mock.fn(),
    requestFullscreen: mock.fn(() => Promise.resolve()),
    requestPointerLock: mock.fn(() => Promise.resolve()),
    focus: mock.fn()
  };
}

class FakeWindowAdapter {
  navigator = new mocks.NavigatorAdapter();
  onbeforeunload: (() => void) | null = null;

  addEventListener = mock.fn();
  removeEventListener = mock.fn();
}

describe("Controls.Input", () => {
  let input: Input;

  beforeEach(() => {
    input = new Input(createFakeCanvas());
  });

  test("constructs one instance of each device, defaulting to the \"default\" preference", () => {
    assert.ok(input.mouse);
    assert.ok(input.keyboard);
    assert.ok(input.gamepad);
    assert.ok(input.touchpad);
    assert.ok(input.screen);
    assert.strictEqual(input.devicePreference, "default");
  });

  test("publishes accumulated mouse state", () => {
    const publish = mock.method(
      input.mouse,
      "publishFrameState"
    );

    input.publishFrameState();

    assert.strictEqual(publish.mock.callCount(), 1);
  });

  describe("device preference", () => {
    test("switches to gamepad on gamepad activity, and back to default on mouse activity", () => {
      const windowAdapter = new FakeWindowAdapter();
      const localCanvas = new mocks.CanvasAdapter();
      const localInput = new Input(localCanvas, {
        windowAdapter,
        documentAdapter: new mocks.DocumentAdapter()
      });
      localInput.mouse.connect();

      const preferences: string[] = [];
      localInput.on(
        "devicePreferenceChange",
        (preference) => preferences.push(preference)
      );

      assert.strictEqual(localInput.devicePreference, "default");

      const fakeGamepad = mocks.Gamepad();
      const button = fakeGamepad.buttons[0];
      assert.ok(button !== null);
      button.pressed = true;
      windowAdapter.navigator.gamepads[0] = fakeGamepad;

      localInput.update();
      assert.strictEqual(localInput.devicePreference, "gamepad");

      windowAdapter.navigator.gamepads[0] = null;
      localCanvas.dispatch(
        "mousedown",
        {
          button: MouseEventButton.left,
          preventDefault: () => void 0
        }
      );
      localInput.update();

      assert.strictEqual(localInput.devicePreference, "default");
      assert.deepStrictEqual(preferences, ["gamepad", "default"]);
    });
  });

  describe("vibrate", () => {
    test("delegates to the window adapter's navigator", () => {
      const windowAdapter = new FakeWindowAdapter();
      const vibrateMock = mock.fn(
        (_pattern: VibratePattern) => true
      );
      windowAdapter.navigator.vibrate = vibrateMock;
      const localInput = new Input(
        createFakeCanvas(),
        { windowAdapter }
      );

      localInput.vibrate([100, 50, 100]);

      assert.strictEqual(vibrateMock.mock.calls.length, 1);
      assert.deepStrictEqual(
        vibrateMock.mock.calls[0].arguments[0],
        [100, 50, 100]
      );
    });
  });
});
