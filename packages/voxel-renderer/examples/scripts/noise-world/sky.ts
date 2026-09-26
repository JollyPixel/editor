// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  color,
  dot,
  float,
  max,
  mix,
  pow,
  smoothstep,
  vec3
} from "three/tsl";

// CONSTANTS
export const HORIZON_COLOR = "#d9e6f2";
export const SUN_DIRECTION = new THREE.Vector3(-0.62, 0.55, 0.56).normalize();

const kSkyBlue = "#9cc4ea";
const kZenith = "#3c74bd";
const kGround = "#c7d3df";
const kGlowSharpness = 12;
const kGlowStrength = 0.45;

export function skyColor(
  direction: THREE.Node<"vec3">,
  sunDirection: THREE.Vector3 = SUN_DIRECTION
): THREE.Node<"vec3"> {
  const up = direction.y;
  const glow = pow(max(dot(direction, vec3(sunDirection)), 0), float(kGlowSharpness))
    .mul(kGlowStrength);
  const lower = mix(
    color(HORIZON_COLOR),
    color(kSkyBlue),
    smoothstep(float(0), float(0.2), up)
  );
  const gradient = mix(
    lower,
    color(kZenith),
    smoothstep(float(0.2), float(0.75), up)
  );
  const below = mix(
    gradient,
    color(kGround),
    smoothstep(float(0), float(-0.25), up)
  );

  return below.add(vec3(1, 0.9, 0.7).mul(glow));
}
