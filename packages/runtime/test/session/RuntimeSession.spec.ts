// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
import {
  GameLoop,
  ManualFrameSource
} from "@jolly-pixel/loop";

// Import Internal Dependencies
import {
  RuntimeSession,
  type RuntimeSessionHost
} from "../../src/session/RuntimeSession.ts";
import {
  RuntimeSessionSettings,
  type RuntimeSessionOptions
} from "../../src/session/RuntimeSessionSettings.ts";
import { OverlayLayer } from "../../src/ui/overlay/OverlayLayer.ts";

describe("RuntimeSession", () => {
  test("claims canvas focus and keypresses with every option off", () => {
    const { host, session, dispose } = startSession({ focusCanvas: false });

    try {
      const keypress = new KeyboardEvent("keypress", { cancelable: true });
      host.canvas.dispatchEvent(keypress);

      assert.equal(document.activeElement, host.canvas);
      assert.equal(keypress.defaultPrevented, true);

      session.dispose();
      const afterDispose = new KeyboardEvent("keypress", { cancelable: true });
      host.canvas.dispatchEvent(afterDispose);
      assert.equal(afterDispose.defaultPrevented, false);
    }
    finally {
      dispose();
    }
  });

  test("refocuses the canvas on a page click until disposed", () => {
    const { host, session, dispose } = startSession({});

    try {
      host.canvas.blur();
      document.body.click();
      assert.equal(document.activeElement, host.canvas);

      session.dispose();
      host.canvas.blur();
      document.body.click();
      assert.notEqual(document.activeElement, host.canvas);
    }
    finally {
      dispose();
    }
  });

  test("mounts the focus hint and removes it on dispose", () => {
    const { host, session, dispose } = startSession({ focusHint: true });

    try {
      assert.equal(host.overlay.element.childElementCount, 1);

      session.dispose();
      assert.equal(host.overlay.element.childElementCount, 0);
    }
    finally {
      dispose();
    }
  });

  test("wakes the loop on page activity only when rendering on demand", (t) => {
    const continuous = startSession({});
    const onDemand = startSession({ renderOnDemand: true });
    const continuousWake = t.mock.method(continuous.host.loop, "invalidate");
    const onDemandWake = t.mock.method(onDemand.host.loop, "invalidate");

    try {
      document.dispatchEvent(new KeyboardEvent("keydown"));
      window.dispatchEvent(new window.Event("gamepadconnected"));
      assert.equal(continuousWake.mock.callCount(), 0);
      assert.equal(onDemandWake.mock.callCount(), 2);

      onDemand.session.dispose();
      document.dispatchEvent(new KeyboardEvent("keydown"));
      window.dispatchEvent(new window.Event("gamepadconnected"));
      assert.equal(onDemandWake.mock.callCount(), 2);
    }
    finally {
      continuous.dispose();
      onDemand.dispose();
    }
  });

  test("suspendWhenHidden waits for the first frame", () => {
    let frames = 0;
    const { dispose } = startSession(
      { suspendWhenHidden: true },
      () => {
        frames++;

        return Promise.withResolvers<void>().promise;
      }
    );

    assert.equal(frames, 1);
    dispose();
  });
});

function startSession(
  options: RuntimeSessionOptions,
  nextFrame: () => Promise<void> = () => Promise.resolve()
) {
  const canvas = document.createElement("canvas");
  canvas.tabIndex = -1;
  document.body.appendChild(canvas);
  const host: RuntimeSessionHost = {
    canvas,
    overlay: new OverlayLayer(canvas),
    renderer: {} as Systems.ThreeRenderer,
    loop: new GameLoop({ source: new ManualFrameSource() }),
    nextFrame,
    viewHelper: null,
    world: {
      input: {
        gamepad: {
          connectedGamepads: 0,
          wasActive: false,
          sample: () => undefined
        }
      }
    }
  };
  const session = new RuntimeSession(
    host,
    new RuntimeSessionSettings(options)
  );

  return {
    host,
    session,
    dispose(): void {
      session.dispose();
      host.overlay.dispose();
      canvas.remove();
    }
  };
}
