// Import Third-party Dependencies
import type { OrbitFlyCamera } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { CAMERA_PREFERENCES } from "../scope/hostPreferences.ts";
import type { Preferences } from "../store/Preferences.ts";
import type { PreferenceValues } from "../scope/PreferenceScope.ts";

export type PreferenceCamera = Pick<
  OrbitFlyCamera,
  | "moveSpeed"
  | "mouseSensitivity"
  | "touchpadLookSensitivity"
  | "invertY"
  | "touchpadSwipe"
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
    if (values.flySpeed !== flySpeed) {
      flySpeed = values.flySpeed;
      camera.moveSpeed = base.moveSpeed * flySpeed;
    }
  }

  apply(preferences.values(CAMERA_PREFERENCES));

  return preferences.watch(CAMERA_PREFERENCES, apply);
}
