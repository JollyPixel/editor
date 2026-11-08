// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { RenderComponent } from "../../core/systems/rendering/Renderer.ts";
import type { PostProcessing } from "./compositing/PostProcessing.ts";

export interface ThreeRenderComponent extends RenderComponent {
  readonly threeCamera: THREE.Camera;
  /**
   * Replaces the direct render with a `THREE.RenderPipeline`.
   * @default null
   */
  readonly postProcessing?: PostProcessing | null;
}
