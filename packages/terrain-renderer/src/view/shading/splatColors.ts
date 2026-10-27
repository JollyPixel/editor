// Import Third-party Dependencies
import type { Node } from "three/webgpu";
import {
  cos,
  fract,
  vec3
} from "three/tsl";

// CONSTANTS
const kGoldenRatio = 0.6180339887;
const kBase = 0.55;
const kRange = 0.4;
const kPhases = [0, 2 / 3, 1 / 3] as const;

export type SplatColor = readonly [red: number, green: number, blue: number];

export function splatOverlayColor(
  slot: number
): SplatColor {
  const hue = (slot * kGoldenRatio) % 1;
  const [red, green, blue] = kPhases.map((phase) => kBase + kRange * Math.cos(2 * Math.PI * (hue + phase)));

  return [red, green, blue];
}

export function splatColorNode(
  slot: Node<"float">
): Node<"vec3"> {
  const hue = fract(slot.mul(kGoldenRatio));

  return cos(vec3(...kPhases).add(hue).mul(2 * Math.PI)).mul(kRange).add(kBase);
}
