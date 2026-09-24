// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  color,
  dot,
  float,
  max,
  mix,
  normalize,
  positionLocal,
  pow,
  smoothstep,
  vec3
} from "three/tsl";

// CONSTANTS
const kHorizon = "#f4dcc0";
const kBlue = "#8db4dc";
const kZenith = "#3a6aad";
const kHaze = "#bfcadb";
const kGlowSharpness = 12;
const kGlowStrength = 0.55;

export function createSkyBackground(
  sunDirection: THREE.Vector3
): THREE.Node {
  const direction = normalize(positionLocal);
  const up = direction.y;
  const glow = pow(max(dot(direction, vec3(sunDirection)), 0), float(kGlowSharpness))
    .mul(kGlowStrength);
  const lower = mix(
    color(kHorizon),
    color(kBlue),
    smoothstep(float(0), float(0.18), up)
  );
  const gradient = mix(
    lower,
    color(kZenith),
    smoothstep(float(0.18), float(0.7), up)
  );
  const below = mix(
    gradient,
    color(kHaze),
    smoothstep(float(0), float(-0.25), up)
  );

  return below.add(vec3(1, 0.85, 0.6).mul(glow));
}
