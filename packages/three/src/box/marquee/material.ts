// Import Third-party Dependencies
import * as THREE from "three";
import { Line2NodeMaterial } from "three/webgpu";
import {
  abs,
  attribute,
  fract,
  fwidth,
  max,
  mix,
  positionGeometry,
  smoothstep,
  uniform,
  varying
} from "three/tsl";

// CONSTANTS
const kMinimumBlur = 0.0001;

export const MARQUEE_PHASE_START = "marqueePhaseStart";
export const MARQUEE_PHASE_END = "marqueePhaseEnd";

export interface MarqueeUniformOptions {
  ratio: number;
  speed: number;
  colors: readonly [
    THREE.ColorRepresentation,
    THREE.ColorRepresentation
  ];
}

export function createMarqueeUniforms(
  options: MarqueeUniformOptions
) {
  const speed = uniform(options.speed, "float");
  const offset = uniform(0, "float").onFrameUpdate(
    ({ deltaTime }, self) => advanceOffset(
      self.value,
      deltaTime * speed.value
    )
  );

  return {
    ratio: uniform(options.ratio, "float"),
    speed,
    offset,
    dashColor: uniform(new THREE.Color(options.colors[0])),
    gapColor: uniform(new THREE.Color(options.colors[1]))
  };
}

export type MarqueeUniforms = ReturnType<typeof createMarqueeUniforms>;

export function advanceOffset(
  offset: number,
  periods: number
): number {
  const advanced = offset + periods;

  return advanced - Math.floor(advanced);
}

export interface BuildMarqueeMaterialOptions {
  width: number;
  uniforms: MarqueeUniforms;
}

export function buildMarqueeMaterial(
  options: BuildMarqueeMaterialOptions
): Line2NodeMaterial {
  const { width, uniforms } = options;

  const material = new Line2NodeMaterial({
    linewidth: width,
    transparent: false,
    depthWrite: false
  });

  const phase = varying(
    positionGeometry.y.lessThan(0.5).select(
      attribute(MARQUEE_PHASE_START, "float"),
      attribute(MARQUEE_PHASE_END, "float")
    )
  );
  const halfDash = uniforms.ratio.mul(0.5);
  const fromDashCenter = abs(
    fract(
      phase.sub(uniforms.offset).sub(halfDash).add(0.5)
    ).sub(0.5)
  );
  const blur = max(fwidth(phase), kMinimumBlur);
  const gap = smoothstep(
    halfDash.sub(blur),
    halfDash.add(blur),
    fromDashCenter
  );

  material.colorNode = mix(
    uniforms.dashColor,
    uniforms.gapColor,
    gap
  );

  return material;
}
