// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import type { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { PostProcessing } from "./compositing/PostProcessing.ts";

export interface ThreeRenderComponent extends Systems.RenderComponent {
  readonly threeCamera: THREE.Camera;
  /**
   * Replaces the direct render with a `THREE.RenderPipeline`.
   * @default null
   */
  readonly postProcessing?: PostProcessing | null;
}
