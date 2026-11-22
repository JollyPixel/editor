// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Systems } from "@jolly-pixel/ecs";
import { type BakedRoomEnvironment, ThreeSceneEnvironment } from "@jolly-pixel/backend.three";
import type { ResolvedThemeMode } from "@jolly-pixel/ui";
import { StudioSky } from "@jolly-pixel/three";
import type { PreviewEnvironment } from "@jolly-pixel/asset.environment/client";

// Import Internal Dependencies
import { ShadowTexelSnap } from "./ShadowTexelSnap.ts";
import { viewEnvironment } from "./viewEnvironments.ts";
import type { ViewSettings } from "../../state/ViewSettings.ts";

// CONSTANTS
const kAmbientOcclusion = 0.75;
const kShadowRadius = 48;
const kShadowMapSize = 2048;
const kShadowNormalBiasTexels = 1.5;
const kOrigin = new THREE.Vector3();

export interface ChunkRendering {
  ambientOcclusion: number;
  blockLight: number;
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface ShadowCasters {
  readonly meshVersion: number;
}

export interface SceneEnvironmentOptions {
  world: Systems.World<THREE.WebGPURenderer, any>;
  roomEnvironment: BakedRoomEnvironment | null;
  preview: Pick<PreviewEnvironment, "resolve">;
  chunks: ChunkRendering;
  casters: ShadowCasters;
  theme: ResolvedThemeMode;
}

export class SceneEnvironment {
  #renderer: Systems.Renderer<THREE.WebGPURenderer>;
  #environment: ThreeSceneEnvironment;
  #preview: Pick<PreviewEnvironment, "resolve">;
  #file: Readonly<Systems.EnvironmentFile>;
  #roomEnvironment: BakedRoomEnvironment | null;
  #chunks: ChunkRendering;
  #casters: ShadowCasters;
  #casterVersion = -1;
  #previewEnvironment: THREE.RenderTarget | null = null;
  #shadows = false;
  #shadowsDirty = true;
  #anchor = new THREE.Vector3(NaN, NaN, NaN);
  #focus = new THREE.Vector3();
  #forward = new THREE.Vector3();
  #sunDirection = new THREE.Vector3();
  #shadowSnap = new ShadowTexelSnap(kShadowRadius * 2, kShadowMapSize);
  #theme: ResolvedThemeMode;

  constructor(
    options: SceneEnvironmentOptions
  ) {
    const { world } = options;
    const { graph } = world.sceneManager;
    this.#renderer = world.renderer;
    this.#environment = new ThreeSceneEnvironment(graph, world, {
      room: options.roomEnvironment
    });
    this.#environment.fallbackSky = new StudioSky(options.theme).node;
    this.#preview = options.preview;
    this.#file = Systems.ENVIRONMENT_PRESETS.default;
    this.#roomEnvironment = options.roomEnvironment;
    this.#chunks = options.chunks;
    this.#casters = options.casters;
    this.#theme = options.theme;

    const { shadow } = this.#environment.sun;
    shadow.autoUpdate = false;
    shadow.mapSize.set(kShadowMapSize, kShadowMapSize);
    shadow.bias = 0;
    shadow.normalBias = this.#shadowSnap.texelSize * kShadowNormalBiasTexels;
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
    this.#file = this.#preview.resolve(
      viewEnvironment(settings.lighting),
      settings
    );
    this.#environment.apply(this.#file);

    this.#chunks.ambientOcclusion = settings.ambientOcclusion ?
      kAmbientOcclusion :
      0;
    this.#chunks.blockLight = settings.blockLight ? 1 : 0;

    this.#shadows = settings.shadows;
    if (settings.shadows) {
      this.#renderer.source.shadowMap.enabled = true;
      this.#environment.sun.castShadow = true;
    }
    else {
      this.#environment.aimSun(kOrigin);
    }
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
    if (theme !== this.#theme) {
      this.#theme = theme;
      this.#environment.fallbackSky = new StudioSky(theme).node;
    }
  }

  get backdrop(): ResolvedThemeMode {
    const { sky } = this.#file;
    switch (sky.kind) {
      case "day":
        return "light";
      case "night":
        return "dark";
      case "color":
        return new THREE.Color(sky.color).getHSL({ h: 0, s: 0, l: 0 }).l > 0.5 ?
          "light" :
          "dark";
      default:
        return this.#theme;
    }
  }

  get environmentMap(): THREE.Texture | null {
    if (this.#previewEnvironment === null && this.#roomEnvironment !== null) {
      this.#previewEnvironment = this.#roomEnvironment.createRenderTarget(
        this.#renderer.source
      );
    }

    return this.#previewEnvironment?.texture ?? null;
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
      this.#environment.copySunDirectionTo(this.#sunDirection)
    );
    if (!this.#focus.equals(this.#anchor)) {
      this.#anchor.copy(this.#focus);
      this.#environment.aimSun(this.#focus, kShadowRadius * 2);
      this.#shadowsDirty = true;
    }

    const { meshVersion } = this.#casters;
    if (meshVersion !== this.#casterVersion) {
      this.#casterVersion = meshVersion;
      this.#shadowsDirty = true;
    }

    if (this.#shadowsDirty) {
      this.#environment.sun.shadow.needsUpdate = true;
      this.#shadowsDirty = false;
    }
  }

  dispose(): void {
    this.#environment.dispose();
    this.#previewEnvironment?.dispose();
    this.#previewEnvironment = null;
  }
}
