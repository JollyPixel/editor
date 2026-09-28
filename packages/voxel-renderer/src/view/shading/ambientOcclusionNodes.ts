// Import Third-party Dependencies
import type { Node } from "three/webgpu";
import {
  float,
  uniform
} from "three/tsl";

export function createAoStrength(
  strength = 0
) {
  return uniform(strength);
}

export type AoStrengthUniform = ReturnType<typeof createAoStrength>;

export function aoFactorNode(
  strength: AoStrengthUniform,
  brightness: Node<"float">
) {
  return float(1).sub(strength.mul(float(1).sub(brightness)));
}
