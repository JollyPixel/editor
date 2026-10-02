// Import Node.js Dependencies
import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Runtime } from "../src/Runtime.ts";
import {
  configureRuntimeDevice,
  isMobileDevice
} from "../src/bootstrap/configureRuntimeDevice.ts";

function createFakeRuntime() {
  const setPixelRatio = mock.fn((_ratio: number) => void 0);
  const runtime = {
    loop: { scheduler: { maxFps: 0 } },
    world: {
      renderer: {
        getSource: () => {
          return { setPixelRatio };
        }
      }
    }
  } as unknown as Runtime;

  return { runtime, setPixelRatio };
}

describe("configureRuntimeDevice", () => {
  test("applies an explicit render cap without fetching GPU benchmarks", async(t) => {
    const fetch = t.mock.method(globalThis, "fetch");
    const { runtime, setPixelRatio } = createFakeRuntime();

    await configureRuntimeDevice(runtime, {
      maxFps: 144
    });

    assert.strictEqual(runtime.loop.scheduler.maxFps, 144);
    assert.strictEqual(setPixelRatio.mock.callCount(), 1);
    assert.strictEqual(fetch.mock.callCount(), 0);
  });

  test("keeps the pixel ratio when adaptivePixelRatio is off", async() => {
    const { runtime, setPixelRatio } = createFakeRuntime();

    await configureRuntimeDevice(runtime, {
      maxFps: Infinity,
      adaptivePixelRatio: false
    });

    assert.strictEqual(runtime.loop.scheduler.maxFps, Infinity);
    assert.strictEqual(setPixelRatio.mock.callCount(), 0);
  });
});

describe("isMobileDevice", () => {
  const desktop = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0",
    platform: "Win32",
    maxTouchPoints: 0
  };

  test("treats a desktop browser as not mobile", () => {
    assert.strictEqual(isMobileDevice(desktop), false);
  });

  test("detects Android and iOS user agents", () => {
    for (const userAgent of [
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"
    ]) {
      assert.strictEqual(isMobileDevice({
        ...desktop,
        userAgent
      }), true, userAgent);
    }
  });

  test("detects an iPad reporting a desktop Mac", () => {
    assert.strictEqual(isMobileDevice({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      maxTouchPoints: 5
    }), true);
    assert.strictEqual(isMobileDevice({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      maxTouchPoints: 0
    }), false);
  });
});
