// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { RenderComponent } from "./Renderer.ts";
import type { PostProcessing } from "./PostProcessing.ts";

export interface CameraPipeline {
  render(): void;
  dispose(): void;
}

export type CameraPipelineFactory = (
  renderer: THREE.WebGPURenderer,
  outputNode: THREE.Node
) => CameraPipeline;

interface CameraPipelineEntry {
  postProcessing: PostProcessing;
  scene: THREE.Scene;
  camera: THREE.Camera;
  pipeline: CameraPipeline;
}

/**
 * One `THREE.RenderPipeline` per post-processed camera, rebuilt when its
 * post-processing, scene or three.js camera changes.
 */
export class CameraPipelines {
  #renderer: THREE.WebGPURenderer;
  #createPipeline: CameraPipelineFactory;
  #entries = new Map<RenderComponent, CameraPipelineEntry>();

  constructor(
    renderer: THREE.WebGPURenderer,
    createPipeline: CameraPipelineFactory = createRenderPipeline
  ) {
    this.#renderer = renderer;
    this.#createPipeline = createPipeline;
  }

  acquire(
    component: RenderComponent,
    scene: THREE.Scene
  ): CameraPipeline | null {
    const postProcessing = component.postProcessing ?? null;
    const camera = component.threeCamera;
    const entry = this.#entries.get(component);

    if (
      entry &&
      entry.postProcessing === postProcessing &&
      entry.scene === scene &&
      entry.camera === camera
    ) {
      return entry.pipeline;
    }

    if (entry) {
      entry.pipeline.dispose();
      this.#entries.delete(component);
    }
    if (postProcessing === null) {
      return null;
    }

    const outputNode = postProcessing({
      renderer: this.#renderer,
      scene,
      camera
    });
    const pipeline = this.#createPipeline(this.#renderer, outputNode);
    this.#entries.set(component, {
      postProcessing,
      scene,
      camera,
      pipeline
    });

    return pipeline;
  }

  retain(
    components: readonly RenderComponent[]
  ): void {
    for (const [component, entry] of this.#entries) {
      if (!components.includes(component)) {
        entry.pipeline.dispose();
        this.#entries.delete(component);
      }
    }
  }

  dispose(): void {
    for (const entry of this.#entries.values()) {
      entry.pipeline.dispose();
    }
    this.#entries.clear();
  }
}

function createRenderPipeline(
  renderer: THREE.WebGPURenderer,
  outputNode: THREE.Node
): CameraPipeline {
  return new THREE.RenderPipeline(renderer, outputNode);
}
