// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
export const AXES: readonly Axis[] = ["x", "y", "z"];
export const AXIS_DIRECTION: Readonly<Record<Axis, THREE.Vector3>> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
};
export const AXIS_COLOR: Readonly<Record<Axis, string>> = {
  x: "#ff6b6b",
  y: "#7ee787",
  z: "#6fb3ff"
};
export const HANDLE_HIGHLIGHT_COLOR = "#ffd452";

export type Axis = "x" | "y" | "z";
export type AxisSign = 1 | -1;
