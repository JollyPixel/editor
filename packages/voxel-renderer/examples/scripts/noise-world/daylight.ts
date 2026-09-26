// Import Third-party Dependencies
import * as THREE from "three/webgpu";
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
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// CONSTANTS
export const HORIZON_COLOR = "#d9e6f2";

const kSunDirection = new THREE.Vector3(-0.62, 0.55, 0.56).normalize();
const kSkyBlue = "#9cc4ea";
const kZenith = "#3c74bd";
const kGround = "#c7d3df";
const kGlowSharpness = 12;
const kGlowStrength = 0.45;
const kShadowRadius = 128;
const kShadowMapSize = 4096;
const kShadowSnap = 4;

export interface DaylightOptions {
  camera: THREE.Camera;
  scene: THREE.Scene;
  renderer: THREE.WebGPURenderer;
}

export class Daylight extends ActorComponent {
  readonly hemisphere = new THREE.HemisphereLight("#bcd6f2", "#8a7454", 1.15);
  readonly sun = new THREE.DirectionalLight("#ffe2b8", 2.7);

  #camera: THREE.Camera;
  #renderer: THREE.WebGPURenderer;
  #focus = new THREE.Vector3();
  #forward = new THREE.Vector3();

  constructor(
    actor: Actor<any>,
    options: DaylightOptions
  ) {
    super({
      actor,
      typeName: "Daylight"
    });

    const { camera, scene, renderer } = options;
    this.#camera = camera;
    this.#renderer = renderer;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;

    scene.background = null;
    scene.backgroundNode = createSkyBackground(kSunDirection);

    const { shadow } = this.sun;
    shadow.mapSize.set(kShadowMapSize, kShadowMapSize);
    shadow.bias = -0.0002;
    shadow.normalBias = 0.05;
    shadow.camera.left = -kShadowRadius;
    shadow.camera.right = kShadowRadius;
    shadow.camera.top = kShadowRadius;
    shadow.camera.bottom = -kShadowRadius;
    shadow.camera.near = 0.5;
    shadow.camera.far = kShadowRadius * 4;
    this.sun.castShadow = true;

    scene.add(this.hemisphere, this.sun, this.sun.target);
  }

  get shadows(): boolean {
    return this.sun.castShadow;
  }

  set shadows(
    value: boolean
  ) {
    this.sun.castShadow = value;
    this.#renderer.shadowMap.enabled = value;
  }

  update(): void {
    this.#camera.getWorldDirection(this.#forward);
    this.#camera
      .getWorldPosition(this.#focus)
      .addScaledVector(this.#forward, kShadowRadius * 0.5);
    this.#focus.set(
      snap(this.#focus.x),
      snap(this.#focus.y),
      snap(this.#focus.z)
    );

    this.sun.target.position.copy(this.#focus);
    this.sun.position
      .copy(kSunDirection)
      .multiplyScalar(kShadowRadius * 2)
      .add(this.#focus);
  }
}

function createSkyBackground(
  sunDirection: THREE.Vector3
): THREE.Node {
  const direction = normalize(positionLocal);
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

function snap(
  value: number
): number {
  return Math.round(value / kShadowSnap) * kShadowSnap;
}
