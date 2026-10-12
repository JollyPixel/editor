// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { BlockLightFalloff } from "@jolly-pixel/voxel.renderer";
import type { ResolvedThemeMode } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { ShadowTexelSnap } from "./ShadowTexelSnap.ts";
import { StudioSky } from "./background/StudioSky.ts";
import type { SceneLighting } from "./SceneLighting.ts";
import type {
  LightingMode,
  ViewSettings
} from "../../state/ViewSettings.ts";

// CONSTANTS
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

export interface ShadowCasters {
  readonly meshVersion: number;
}

export interface SceneEnvironmentOptions {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  lighting: SceneLighting;
  chunks: ChunkRendering;
  casters: ShadowCasters;
  theme: ResolvedThemeMode;
}

export class SceneEnvironment {
  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #lighting: SceneLighting;
  #chunks: ChunkRendering;
  #casters: ShadowCasters;
  #casterVersion = -1;
  #environment: THREE.RenderTarget | null = null;
  #shadows = false;
  #shadowsDirty = true;
  #anchor = new THREE.Vector3(NaN, NaN, NaN);
  #focus = new THREE.Vector3();
  #forward = new THREE.Vector3();
  #sunDirection = new THREE.Vector3();
  #shadowSnap = new ShadowTexelSnap(kShadowRadius * 2, kShadowMapSize);
  #theme: ResolvedThemeMode;
  #skies = new Map<LightingMode, THREE.Node>();
  #studioSkies = new Map<ResolvedThemeMode, THREE.Node>();

  constructor(
    options: SceneEnvironmentOptions
  ) {
    this.#renderer = options.renderer;
    this.#scene = options.scene;
    this.#lighting = options.lighting;
    this.#chunks = options.chunks;
    this.#casters = options.casters;
    this.#theme = options.theme;

    const { shadow } = this.#lighting.directional;
    shadow.autoUpdate = false;
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
    this.#anchor.set(NaN, NaN, NaN);
    this.invalidateShadows();
  }

  get theme(): ResolvedThemeMode {
    return this.#theme;
  }

  set theme(
    theme: ResolvedThemeMode
  ) {
    this.#theme = theme;
    this.#applyBackground();
  }

  invalidateShadows(): void {
    this.#shadowsDirty = true;
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
    if (!this.#focus.equals(this.#anchor)) {
      this.#anchor.copy(this.#focus);
      this.#lighting.aim(this.#focus, kShadowRadius * 2);
      this.#shadowsDirty = true;
    }

    const { meshVersion } = this.#casters;
    if (meshVersion !== this.#casterVersion) {
      this.#casterVersion = meshVersion;
      this.#shadowsDirty = true;
    }

    if (this.#shadowsDirty) {
      this.#lighting.directional.shadow.needsUpdate = true;
      this.#shadowsDirty = false;
    }
  }

  dispose(): void {
    this.#scene.environment = null;
    this.#environment?.dispose();
    this.#environment = null;
  }

  #applyBackground(): void {
    this.#scene.background = null;
    this.#scene.backgroundNode = this.#backgroundNode();
  }

  #backgroundNode(): THREE.Node {
    const { mode, rig: { sky } } = this.#lighting;
    if (sky === null) {
      let studio = this.#studioSkies.get(this.#theme);
      if (studio === undefined) {
        studio = new StudioSky(this.#theme).node;
        this.#studioSkies.set(this.#theme, studio);
      }

      return studio;
    }

    let node = this.#skies.get(mode);
    if (node === undefined) {
      node = new sky(this.#lighting.sunDirection).node;
      this.#skies.set(mode, node);
    }

    return node;
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
