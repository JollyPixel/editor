// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { texture } from "three/tsl";

// Import Internal Dependencies
import type { CameraPipeline } from "./CameraPipelines.ts";

/**
 * Runs a `THREE.RenderPipeline` into its own target, then draws that target
 * through the renderer output so later renders composite over it.
 */
export class OffscreenCameraPipeline implements CameraPipeline {
  #renderer: THREE.WebGPURenderer;
  #pipeline: THREE.RenderPipeline;
  #target = new THREE.RenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false
  });
  #material = new THREE.NodeMaterial();
  #quad = new THREE.QuadMesh(this.#material);
  #size = new THREE.Vector2();

  constructor(
    renderer: THREE.WebGPURenderer,
    outputNode: THREE.Node
  ) {
    this.#renderer = renderer;
    this.#pipeline = new THREE.RenderPipeline(renderer, outputNode);
    this.#pipeline.outputColorTransform = false;

    this.#material.fragmentNode = texture(this.#target.texture);
    this.#material.depthTest = false;
    this.#material.depthWrite = false;
  }

  render(): void {
    const renderer = this.#renderer;
    const target = renderer.getRenderTarget();
    const { x: width, y: height } = renderer.getDrawingBufferSize(this.#size);
    this.#target.setSize(width, height);

    renderer.setRenderTarget(this.#target);
    try {
      this.#pipeline.render();
    }
    finally {
      renderer.setRenderTarget(target);
    }
    this.#quad.render(renderer);
  }

  dispose(): void {
    this.#pipeline.dispose();
    this.#material.dispose();
    this.#target.dispose();
  }
}
