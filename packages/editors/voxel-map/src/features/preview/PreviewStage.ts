// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { Systems } from "@jolly-pixel/engine";
import {
  ReadbackPixels,
  renderToTarget
} from "@jolly-pixel/three";

// Import Internal Dependencies
import { SceneLighting } from "../../scene/environment/SceneLighting.ts";

// CONSTANTS
const kCameraFov = 45;
const kCameraZ = 2.2;
const kFitFactor = 0.78;
const kEnvironmentIntensity = 0.6;
const kMinPixelRatio = 2;
const kMaxPixelRatio = 3;
const kSamples = 4;

const kPreviewFitRadius = Math.tan((kCameraFov * Math.PI) / 360) *
  kCameraZ * kFitFactor;
export interface PreviewAngle {
  readonly yaw: number;
  readonly pitch: number;
}

export const PREVIEW_REST_ANGLE: PreviewAngle = {
  yaw: Math.PI / 4,
  pitch: 0.4
};

export interface PreviewStageOptions {
  renderer: Systems.Renderer<THREE.WebGPURenderer>;
  environmentMap: () => THREE.Texture | null;
}

export class PreviewStage {
  readonly #renderer: Systems.Renderer<THREE.WebGPURenderer>;
  readonly #environmentMap: () => THREE.Texture | null;
  readonly #scene = new THREE.Scene();
  readonly #camera = new THREE.PerspectiveCamera(kCameraFov, 1, 0.1, 20);

  constructor(
    options: PreviewStageOptions
  ) {
    this.#renderer = options.renderer;
    this.#environmentMap = options.environmentMap;
    this.#scene.add(...new SceneLighting().lights);
    this.#camera.position.set(0, 0, kCameraZ);
  }

  get pixelRatio(): number {
    return Math.min(
      Math.max(Math.ceil(window.devicePixelRatio), kMinPixelRatio),
      kMaxPixelRatio
    );
  }

  createTarget(): THREE.RenderTarget {
    const target = new THREE.RenderTarget(1, 1, {
      samples: kSamples
    });
    target.texture.colorSpace = THREE.SRGBColorSpace;

    return target;
  }

  watchCompiles(
    listener: () => void
  ): () => void {
    this.#renderer.on("compiled", listener);

    return () => this.#renderer.off("compiled", listener);
  }

  async capture(
    target: THREE.RenderTarget,
    mesh: THREE.Mesh,
    angle: PreviewAngle
  ): Promise<ImageData> {
    if (this.#scene.environment === null && needsEnvironment(mesh)) {
      this.#scene.environment = this.#environmentMap();
      this.#scene.environmentIntensity = kEnvironmentIntensity;
    }

    mesh.rotation.set(angle.pitch, angle.yaw, 0);
    this.#scene.add(mesh);
    const renderer = this.#renderer.getSource();
    try {
      renderToTarget(renderer, this.#scene, this.#camera, target);
    }
    finally {
      this.#scene.remove(mesh);
    }

    const pixels = await ReadbackPixels.fromRenderTarget(renderer, target);

    return pixels.toImageData();
  }
}

function needsEnvironment(
  mesh: THREE.Mesh
): boolean {
  const materials = Array.isArray(mesh.material) ?
    mesh.material :
    [mesh.material];

  return materials.some(
    (material) => material instanceof THREE.MeshStandardMaterial
  );
}

export function fitGeometry(
  geometry: THREE.BufferGeometry
): void {
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (sphere === null || sphere.radius <= 0) {
    return;
  }

  const { center, radius } = sphere;
  const scale = kPreviewFitRadius / radius;
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(scale, scale, scale);
}
