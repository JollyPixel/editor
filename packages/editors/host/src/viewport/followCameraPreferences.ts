// Import Third-party Dependencies
import {
  OrbitFlyKeys,
  type OrbitFlyCamera
} from "@jolly-pixel/engine";
import type {
  Preferences,
  PreferenceValues
} from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { CAMERA_PREFERENCES } from "../preferences/hostPreferences.ts";

export type PreferenceCamera = Pick<
  OrbitFlyCamera,
  | "moveSpeed"
  | "mouseSensitivity"
  | "touchpadLookSensitivity"
  | "invertY"
  | "touchpadSwipe"
  | "keys"
>;

type CameraValues = PreferenceValues<typeof CAMERA_PREFERENCES.fields>;

export function followCameraPreferences(
  camera: PreferenceCamera,
  preferences: Preferences
): () => void {
  const base = {
    moveSpeed: camera.moveSpeed,
    mouseSensitivity: camera.mouseSensitivity,
    touchpadLookSensitivity: camera.touchpadLookSensitivity
  };
  let flySpeed: number | null = null;

  function apply(
    values: CameraValues
  ): void {
    camera.mouseSensitivity = base.mouseSensitivity * values.lookSensitivity;
    camera.touchpadLookSensitivity = base.touchpadLookSensitivity *
      values.lookSensitivity;
    camera.invertY = values.invertY;
    camera.touchpadSwipe = values.touchpadSwipe;
    camera.keys = OrbitFlyKeys.from(values);
    if (values.flySpeed !== flySpeed) {
      flySpeed = values.flySpeed;
      camera.moveSpeed = base.moveSpeed * flySpeed;
    }
  }

  apply(preferences.values(CAMERA_PREFERENCES));

  return preferences.watch(CAMERA_PREFERENCES, apply);
}
