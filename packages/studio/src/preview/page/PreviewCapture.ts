// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
import {
  ReadbackPixels,
  renderToTarget
} from "@jolly-pixel/three";
import * as THREE from "three/webgpu";

// CONSTANTS
const kFov = 35;
const kYaw = Math.PI / 4;
const kPitch = 0.5;
const kMargin = 1.1;
const kSamples = 4;
const kMinSize = 16;
const kMaxSize = 1024;
const kMaxCompileRounds = 8;

export interface PreviewCaptureOptions {
  renderer: Systems.ThreeRenderer;
  scene: THREE.Scene;
}

export class PreviewCapture {
  readonly #renderer: Systems.ThreeRenderer;
  readonly #scene: THREE.Scene;
  readonly #camera = new THREE.PerspectiveCamera(kFov, 1, 0.01, 100);

  constructor(
    options: PreviewCaptureOptions
  ) {
    this.#renderer = options.renderer;
    this.#scene = options.scene;
  }

  async capture(
    object: THREE.Object3D,
    size: number
  ): Promise<Uint8Array<ArrayBuffer>> {
    this.#frame(object);
    const edge = Math.min(Math.max(Math.round(size), kMinSize), kMaxSize);
    const target = new THREE.RenderTarget(edge, edge, {
      samples: kSamples
    });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    try {
      this.#render(target);
      for (
        let round = 0;
        round < kMaxCompileRounds && this.#renderer.pendingCompiles > 0;
        round++
      ) {
        await this.#renderer.compiled();
        this.#render(target);
      }
      const pixels = await ReadbackPixels.fromRenderTarget(
        this.#renderer.source,
        target
      );

      return await encodePng(pixels.toImageData());
    }
    finally {
      target.dispose();
    }
  }

  #frame(
    object: THREE.Object3D
  ): void {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) {
      throw new Error("The asset shows nothing to preview.");
    }

    const { center, radius } = box.getBoundingSphere(new THREE.Sphere());
    const distance = Math.max(radius, 0.01) * kMargin /
      Math.sin(THREE.MathUtils.degToRad(kFov) / 2);
    const camera = this.#camera;
    camera.position.set(
      Math.cos(kPitch) * Math.sin(kYaw),
      Math.sin(kPitch),
      Math.cos(kPitch) * Math.cos(kYaw)
    ).multiplyScalar(distance).add(center);
    camera.near = Math.max(distance - (radius * 2), distance / 1000);
    camera.far = distance + (radius * 2);
    camera.updateProjectionMatrix();
    camera.lookAt(center);
  }

  #render(
    target: THREE.RenderTarget
  ): void {
    renderToTarget(
      this.#renderer.source,
      this.#scene,
      this.#camera,
      target
    );
  }
}

async function encodePng(
  image: ImageData
): Promise<Uint8Array<ArrayBuffer>> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("No 2D context to encode the preview.");
  }
  context.putImageData(image, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });

  return new Uint8Array(await blob.arrayBuffer());
}
