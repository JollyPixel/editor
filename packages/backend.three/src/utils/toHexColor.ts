// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { Systems } from "@jolly-pixel/ecs";

export function toHexColor(
  value: THREE.ColorRepresentation
): Systems.ColorJSON {
  return `#${new THREE.Color(value).getHexString()}`;
}
