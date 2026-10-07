// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  color,
  dot,
  float,
  floor,
  Fn,
  If,
  length,
  max,
  mix,
  mx_cell_noise_vec3,
  mx_noise_float,
  normalize,
  positionLocal,
  pow,
  smoothstep,
  step,
  vec3
} from "three/tsl";

// CONSTANTS
const kHorizon = "#1d2846";
const kMidnight = "#0d1430";
const kZenith = "#04060f";
const kGround = "#090b13";
const kStarScale = 180;
const kStarChance = 0.06;
const kStarRadius = 0.2;
const kMoonColor = "#e6ecfb";
const kMoonRadius = 0.035;
const kMoonInner = 0.9;
const kMoonEdge = Math.cos(kMoonRadius);
const kStarHorizon = 0.02;
const kMoonMariaScale = 70;
const kHaloSharpness = 90;
const kHaloStrength = 0.35;
const kGlowSharpness = 6;
const kGlowStrength = 0.06;

export class NightSkyBackground {
  readonly node: THREE.Node;

  constructor(
    moonDirection: THREE.Vector3
  ) {
    this.node = Fn(() => {
      const direction = normalize(positionLocal).toVar();
      const up = direction.y;
      const facing = dot(direction, vec3(moonDirection)).toVar();

      const lower = mix(
        color(kHorizon),
        color(kMidnight),
        smoothstep(float(0), float(0.25), up)
      );
      const gradient = mix(
        lower,
        color(kZenith),
        smoothstep(float(0.25), float(0.85), up)
      );
      const sky = mix(
        gradient,
        color(kGround),
        smoothstep(float(0), float(-0.2), up)
      );
      const halo = pow(max(facing, 0), float(kHaloSharpness)).mul(kHaloStrength)
        .add(pow(max(facing, 0), float(kGlowSharpness)).mul(kGlowStrength));
      const disc = smoothstep(
        float(kMoonEdge),
        float(Math.cos(kMoonRadius * kMoonInner)),
        facing
      ).toVar();
      const light = sky.add(vec3(0.62, 0.72, 1).mul(halo)).toVar();

      If(facing.greaterThan(kMoonEdge), () => {
        const maria = mix(
          float(1),
          float(0.78),
          smoothstep(
            float(0.05),
            float(0.45),
            mx_noise_float(direction.mul(kMoonMariaScale))
          )
        );
        light.addAssign(color(kMoonColor).mul(disc.mul(maria)));
      });

      If(up.greaterThan(kStarHorizon), () => {
        const point = direction.mul(kStarScale);
        const cell = floor(point);
        const random = mx_cell_noise_vec3(point);
        const center = cell.add(random.mul(0.6).add(0.2));
        const star = smoothstep(
          float(kStarRadius),
          float(0),
          length(point.sub(center))
        )
          .mul(step(float(1 - kStarChance), random.x))
          .mul(random.z.mul(0.7).add(0.3))
          .mul(smoothstep(float(kStarHorizon), float(0.3), up))
          .mul(disc.oneMinus());
        const starColor = mix(
          vec3(1, 0.92, 0.82),
          vec3(0.8, 0.88, 1),
          random.y
        );
        light.addAssign(starColor.mul(star));
      });

      return light;
    })();
  }
}
