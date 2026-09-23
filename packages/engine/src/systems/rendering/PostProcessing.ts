// Import Third-party Dependencies
import * as THREE from "three/webgpu";

export interface PostProcessingContext {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
}

/**
 * Builds the output node of a camera's `THREE.RenderPipeline`.
 */
export type PostProcessing = (
  context: PostProcessingContext
) => THREE.Node;
