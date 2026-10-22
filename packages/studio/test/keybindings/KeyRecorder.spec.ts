// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  KeyRecorder,
  type KeyRecording
} from "../../src/keybindings/KeyRecorder.ts";
import { STUDIO_PREFERENCES } from "../../shared/studioScope.ts";

interface RecorderProbe {
  recorder: KeyRecorder;
  target: EventTarget;
  recorded: string[][];
}

function recorder(): RecorderProbe {
  const target = new EventTarget();
  const recorded: string[][] = [];

  return {
    target,
    recorded,
    recorder: new KeyRecorder({
      target,
      onChange: () => undefined,
      onRecorded: (_recording, bindings) => recorded.push([...bindings])
    })
  };
}

function recording(
  kind: KeyRecording["kind"]
): KeyRecording {
  return {
    scope: STUDIO_PREFERENCES,
    action: "forward",
    kind
  };
}

function press(
  target: EventTarget,
  init: KeyboardEventInit
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    cancelable: true,
    ...init
  });
  target.dispatchEvent(event);

  return event;
}

describe("KeyRecorder", () => {
  test("records the held key position and stops", () => {
    const { recorder: keys, target, recorded } = recorder();
    keys.start(recording("key"));

    const event = press(target, { key: "z", code: "KeyW" });
    press(target, { key: "a", code: "KeyQ" });

    assert.deepEqual(recorded, [["KeyW"]]);
    assert.equal(event.defaultPrevented, true);
    assert.equal(keys.recording, null);
  });

  test("waits past a lone modifier for a shortcut", () => {
    const { recorder: keys, target, recorded } = recorder();
    keys.start(recording("chord"));

    press(target, { key: "Shift", code: "ShiftLeft", shiftKey: true });
    press(target, { key: "F5", code: "F5", shiftKey: true });

    assert.deepEqual(recorded, [["Shift+F5"]]);
  });

  test("cancels on Escape without recording", () => {
    const { recorder: keys, target, recorded } = recorder();
    keys.start(recording("key"));

    press(target, { key: "Escape", code: "Escape" });
    press(target, { key: "w", code: "KeyW" });

    assert.deepEqual(recorded, []);
    assert.equal(keys.recording, null);
  });
});
