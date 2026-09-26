// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  cameraPosition,
  exp,
  fog,
  length,
  normalize,
  positionWorld,
  smoothstep,
  uniform
} from "three/tsl";

// Import Internal Dependencies
import { skyColor } from "./sky.ts";

// CONSTANTS
const kVeilWidthChunks = 3;
const kUnveiledStart = 1e8;
const kUnveiledEnd = 2e8;

export interface HorizonFogOptions {
  density?: number;
  floor?: number;
  height?: number;
}

export class HorizonFog {
  readonly node: THREE.Node;
  readonly density = uniform(0);
  readonly floor = uniform(0);
  readonly height = uniform(0);

  #veilStart = uniform(kUnveiledStart);
  #veilEnd = uniform(kUnveiledEnd);

  constructor(
    options: HorizonFogOptions = {}
  ) {
    const {
      density = 0.002,
      floor = 0,
      height = 64
    } = options;

    this.density.value = density;
    this.floor.value = floor;
    this.height.value = height;

    const distance = length(positionWorld.xz.sub(cameraPosition.xz));
    const altitude = positionWorld.y.sub(this.floor).max(0);
    const localDensity = this.density.mul(
      exp(altitude.div(this.height).negate())
    );
    const air = localDensity
      .mul(distance)
      .pow(2)
      .negate()
      .exp()
      .oneMinus();
    const veil = smoothstep(this.#veilStart, this.#veilEnd, distance);
    const factor = air.add(veil).sub(air.mul(veil));
    const direction = normalize(positionWorld.sub(cameraPosition));

    this.node = fog(skyColor(direction), factor);
  }

  veil(
    radius: number,
    chunkSize: number
  ): void {
    const end = radius - (chunkSize * Math.SQRT1_2);

    this.#veilEnd.value = end;
    this.#veilStart.value = end - (chunkSize * kVeilWidthChunks);
  }

  unveil(): void {
    this.#veilEnd.value = kUnveiledEnd;
    this.#veilStart.value = kUnveiledStart;
  }
}
