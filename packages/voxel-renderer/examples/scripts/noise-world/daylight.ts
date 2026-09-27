// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  normalize,
  positionLocal
} from "three/tsl";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  HorizonFog,
  type HorizonFogOptions
} from "./fog.ts";
import {
  skyColor,
  SUN_DIRECTION
} from "./sky.ts";

// CONSTANTS
const kShadowRadius = 128;
const kShadowMapSize = 4096;
const kShadowSnap = 16;

export interface DaylightOptions {
  camera: THREE.Camera;
  scene: THREE.Scene;
  renderer: THREE.WebGPURenderer;
  fog?: HorizonFogOptions;
}

export class Daylight extends ActorComponent {
  readonly hemisphere = new THREE.HemisphereLight("#bcd6f2", "#8a7454", 1.15);
  readonly sun = new THREE.DirectionalLight("#ffe2b8", 2.7);
  readonly fog: HorizonFog;

  #camera: THREE.Camera;
  #renderer: THREE.WebGPURenderer;
  #focus = new THREE.Vector3();
  #forward = new THREE.Vector3();
  #anchor = new THREE.Vector3(Infinity, Infinity, Infinity);
  #lightX = new THREE.Vector3();
  #lightY = new THREE.Vector3();
  #shadowsDirty = true;

  constructor(
    actor: Actor<any>,
    options: DaylightOptions
  ) {
    super({
      actor,
      typeName: "Daylight"
    });

    const { camera, scene, renderer, fog } = options;
    this.#camera = camera;
    this.#renderer = renderer;
    this.fog = new HorizonFog(fog);

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;

    scene.background = null;
    scene.backgroundNode = skyColor(normalize(positionLocal), SUN_DIRECTION);
    scene.fog = null;
    scene.fogNode = this.fog.node;

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
    shadow.autoUpdate = false;
    this.sun.castShadow = true;
    this.#lightX
      .crossVectors(THREE.Object3D.DEFAULT_UP, SUN_DIRECTION)
      .normalize();
    this.#lightY.crossVectors(SUN_DIRECTION, this.#lightX);

    scene.add(this.hemisphere, this.sun, this.sun.target);
  }

  get shadows(): boolean {
    return this.#renderer.shadowMap.enabled;
  }

  set shadows(
    value: boolean
  ) {
    this.#renderer.shadowMap.enabled = value;
    this.invalidateShadows();
  }

  invalidateShadows(): void {
    this.#shadowsDirty = true;
  }

  watchCasters(
    group: THREE.Object3D
  ): void {
    group.addEventListener("childadded", () => this.invalidateShadows());
    group.addEventListener("childremoved", () => this.invalidateShadows());
  }

  update(): void {
    this.#camera.getWorldDirection(this.#forward);
    this.#camera
      .getWorldPosition(this.#focus)
      .addScaledVector(this.#forward, kShadowRadius * 0.5);
    const x = snap(this.#focus.dot(this.#lightX));
    const y = snap(this.#focus.dot(this.#lightY));
    const z = snap(this.#focus.dot(SUN_DIRECTION));
    this.#focus
      .copy(this.#lightX)
      .multiplyScalar(x)
      .addScaledVector(this.#lightY, y)
      .addScaledVector(SUN_DIRECTION, z);

    if (!this.#focus.equals(this.#anchor)) {
      this.#anchor.copy(this.#focus);
      this.sun.target.position.copy(this.#focus);
      this.sun.position
        .copy(SUN_DIRECTION)
        .multiplyScalar(kShadowRadius * 2)
        .add(this.#focus);
      this.#shadowsDirty = true;
    }

    if (this.#shadowsDirty && this.shadows) {
      this.sun.shadow.needsUpdate = true;
      this.#shadowsDirty = false;
    }
  }
}

function snap(
  value: number
): number {
  return Math.round(value / kShadowSnap) * kShadowSnap;
}
