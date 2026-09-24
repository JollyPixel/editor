// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Import Internal Dependencies
import type { SceneLighting } from "./SceneLighting.ts";
import { createSkyBackground } from "./skyBackground.ts";
import type { ViewSettings } from "../state/ViewStore.ts";

// CONSTANTS
const kBackground = "#262627";
const kAmbientOcclusion = 0.75;
const kEnvironmentBlur = 0.04;
const kEnvironmentIntensity = 0.6;
const kShadowRadius = 48;
const kShadowMapSize = 2048;
const kShadowSnap = 2;

export interface ChunkRendering {
  ambientOcclusion: number;
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface SceneEnvironmentOptions {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  lighting: SceneLighting;
  chunks: ChunkRendering;
}

export class SceneEnvironment {
  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #lighting: SceneLighting;
  #chunks: ChunkRendering;
  #environment: THREE.RenderTarget | null = null;
  #shadows = false;
  #focus = new THREE.Vector3();
  #forward = new THREE.Vector3();

  constructor(
    options: SceneEnvironmentOptions
  ) {
    this.#renderer = options.renderer;
    this.#scene = options.scene;
    this.#lighting = options.lighting;
    this.#chunks = options.chunks;

    const { shadow } = this.#lighting.directional;
    shadow.mapSize.set(kShadowMapSize, kShadowMapSize);
    shadow.bias = -0.0002;
    shadow.normalBias = 0.02;
    shadow.camera.left = -kShadowRadius;
    shadow.camera.right = kShadowRadius;
    shadow.camera.top = kShadowRadius;
    shadow.camera.bottom = -kShadowRadius;
    shadow.camera.near = 0.5;
    shadow.camera.far = kShadowRadius * 4;
  }

  apply(
    settings: Readonly<ViewSettings>
  ): void {
    this.#lighting.mode = settings.lighting;
    this.#applyBackground(settings.lighting === "daylight");

    this.#scene.environment = settings.reflections ?
      this.#environmentMap() :
      null;
    this.#scene.environmentIntensity = kEnvironmentIntensity;

    this.#chunks.ambientOcclusion = settings.ambientOcclusion ?
      kAmbientOcclusion :
      0;

    this.#shadows = settings.shadows;
    if (settings.shadows) {
      this.#renderer.shadowMap.enabled = true;
    }
    else {
      this.#lighting.aim();
    }
    this.#lighting.directional.castShadow = settings.shadows;
    this.#chunks.castShadow = settings.shadows;
    this.#chunks.receiveShadow = settings.shadows;
  }

  follow(
    camera: THREE.Camera
  ): void {
    if (!this.#shadows) {
      return;
    }

    camera.getWorldDirection(this.#forward);
    this.#focus
      .copy(camera.position)
      .addScaledVector(this.#forward, kShadowRadius * 0.5);
    this.#focus.set(
      snap(this.#focus.x),
      snap(this.#focus.y),
      snap(this.#focus.z)
    );
    this.#lighting.aim(this.#focus, kShadowRadius * 2);
  }

  dispose(): void {
    this.#scene.environment = null;
    this.#environment?.dispose();
    this.#environment = null;
  }

  #applyBackground(
    sky: boolean
  ): void {
    this.#scene.background = sky ? null : new THREE.Color(kBackground);
    this.#scene.backgroundNode = sky ?
      createSkyBackground(this.#lighting.sunDirection) :
      null;
  }

  #environmentMap(): THREE.Texture {
    if (this.#environment === null) {
      const room = new RoomEnvironment();
      const generator = new THREE.PMREMGenerator(this.#renderer);
      this.#environment = generator.fromScene(room, kEnvironmentBlur);
      generator.dispose();
      room.dispose();
    }

    return this.#environment.texture;
  }
}

function snap(
  value: number
): number {
  return Math.round(value / kShadowSnap) * kShadowSnap;
}
