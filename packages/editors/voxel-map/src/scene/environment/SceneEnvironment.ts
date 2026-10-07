// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { BlockLightFalloff } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { ShadowTexelSnap } from "./ShadowTexelSnap.ts";
import type { SceneLighting } from "./SceneLighting.ts";
import type {
  LightingMode,
  ViewSettings
} from "../../state/ViewSettings.ts";

// CONSTANTS
const kBackground = "#262627";
const kAmbientOcclusion = 0.75;
const kEnvironmentBlur = 0.04;
const kShadowRadius = 48;
const kShadowMapSize = 2048;

export interface ChunkRendering {
  ambientOcclusion: number;
  blockLight: number;
  blockLightFalloff: BlockLightFalloff;
  shadowFill: number;
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
  #sunDirection = new THREE.Vector3();
  #shadowSnap = new ShadowTexelSnap(kShadowRadius * 2, kShadowMapSize);
  #background = new THREE.Color(kBackground);
  #skies = new Map<LightingMode, THREE.Node>();

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
    settings: ViewSettings
  ): void {
    this.#lighting.mode = settings.lighting;
    const { rig } = this.#lighting;
    this.#applyBackground();

    this.#scene.environment = settings.reflections ?
      this.#environmentMap() :
      null;
    this.#scene.environmentIntensity = rig.environmentIntensity;

    this.#chunks.ambientOcclusion = settings.ambientOcclusion ?
      kAmbientOcclusion :
      0;
    this.#chunks.blockLight = settings.blockLight ? 1 : 0;
    this.#chunks.blockLightFalloff = rig.blockLightFalloff;
    this.#chunks.shadowFill = rig.shadowFill;

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
    this.#shadowSnap.apply(
      this.#focus,
      this.#lighting.copySunDirectionTo(this.#sunDirection)
    );
    this.#lighting.aim(this.#focus, kShadowRadius * 2);
  }

  dispose(): void {
    this.#scene.environment = null;
    this.#environment?.dispose();
    this.#environment = null;
  }

  #applyBackground(): void {
    const { mode, rig: { sky } } = this.#lighting;
    if (sky === null) {
      this.#scene.background = this.#background;
      this.#scene.backgroundNode = null;

      return;
    }

    let node = this.#skies.get(mode);
    if (node === undefined) {
      node = new sky(this.#lighting.sunDirection).node;
      this.#skies.set(mode, node);
    }
    this.#scene.background = null;
    this.#scene.backgroundNode = node;
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
