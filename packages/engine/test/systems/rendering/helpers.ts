// Import Node.js Dependencies
import { mock } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type {
  RenderComponent,
  RenderViewport
} from "../../../src/systems/rendering/Renderer.ts";

export interface RenderComponentStubOptions {
  depth?: number;
  viewport?: RenderViewport | null;
  camera?: THREE.Camera;
}

export function createRenderComponent(
  options: RenderComponentStubOptions = {}
) {
  const {
    depth = 0,
    viewport = null,
    camera = new THREE.PerspectiveCamera()
  } = options;

  return {
    threeCamera: camera,
    depth,
    viewport,
    prepareRender: mock.fn()
  } satisfies RenderComponent & { prepareRender: ReturnType<typeof mock.fn>; };
}

/**
 * Records the WebGPURenderer calls DirectRenderStrategy makes. No real GPU
 * context is needed since these are hand-shaped spies, not a real renderer.
 */
export function createRendererSpy() {
  return {
    setViewport: mock.fn(),
    setScissor: mock.fn(),
    setScissorTest: mock.fn(),
    setSize: mock.fn(),
    clear: mock.fn(),
    render: mock.fn(),
    dispose: mock.fn(),
    getSize: (target: THREE.Vector2) => target.set(800, 600),
    getPixelRatio: () => 1,
    getRenderTarget: () => null,
    setRenderTarget: mock.fn(),
    outputColorSpace: THREE.SRGBColorSpace
  };
}
