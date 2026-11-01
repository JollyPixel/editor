// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ORBIT_FLY_DEFAULT_KEYS,
  OrbitFlyKeys
} from "@jolly-pixel/engine";
import { Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { CAMERA_PREFERENCES } from "#src/index.ts";
import {
  followCameraPreferences,
  type PreferenceCamera
} from "#src/viewport/index.ts";

function createCamera(): PreferenceCamera {
  return {
    moveSpeed: 6,
    mouseSensitivity: 0.003,
    touchpadLookSensitivity: 0.36,
    invertY: false,
    touchpadSwipe: "look",
    keys: OrbitFlyKeys.default
  };
}

describe("followCameraPreferences", () => {
  test("scales the editor's own speeds and follows later changes", () => {
    const camera = createCamera();
    const preferences = new Preferences({
      overrides: [["camera", { lookSensitivity: 2, flySpeed: 0.5 }]]
    });

    followCameraPreferences(camera, preferences);
    const { keys: _keys, ...look } = camera;

    assert.deepEqual(look, {
      moveSpeed: 3,
      mouseSensitivity: 0.006,
      touchpadLookSensitivity: 0.72,
      invertY: false,
      touchpadSwipe: "look"
    });

    preferences.assign(CAMERA_PREFERENCES, "touchpadSwipe", "pan");
    preferences.assign(CAMERA_PREFERENCES, "lookSensitivity", 1);

    assert.equal(camera.touchpadSwipe, "pan");
    assert.equal(camera.mouseSensitivity, 0.003);
  });

  test("keeps the speed the wheel set until the fly speed preference changes", () => {
    const camera = createCamera();
    const preferences = new Preferences();
    followCameraPreferences(camera, preferences);

    camera.moveSpeed = 20;
    preferences.assign(CAMERA_PREFERENCES, "invertY", true);

    assert.equal(camera.moveSpeed, 20);

    preferences.assign(CAMERA_PREFERENCES, "flySpeed", 2);

    assert.equal(camera.moveSpeed, 12);
  });

  test("binds the camera's default keys, the overrides and later rebinds", () => {
    const camera = createCamera();
    const preferences = new Preferences({
      overrides: [["camera", { forward: ["KeyE"] }]]
    });
    followCameraPreferences(camera, preferences);

    assert.deepEqual(camera.keys.codes, {
      ...ORBIT_FLY_DEFAULT_KEYS,
      forward: ["KeyE"]
    });

    preferences.assign(CAMERA_PREFERENCES, "down", ["ControlLeft"]);

    assert.deepEqual(camera.keys.codes.down, ["ControlLeft"]);
  });
});
