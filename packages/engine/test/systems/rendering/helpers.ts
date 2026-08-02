// Import Node.js Dependencies
import { mock } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

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
 * Records the WebGLRenderer calls the strategies make. Enough surface for
 * EffectComposer to be constructed, which never touches GL until it renders.
 */
export function createWebGLRendererSpy() {
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
    getContext: () => {
      return { getParameter: () => 0 };
    },
    getRenderTarget: () => null,
    setRenderTarget: mock.fn(),
    outputColorSpace: THREE.SRGBColorSpace
  };
}

/**
 * Minimal RenderPass stand-in — orderRenderPasses only reads/writes the clear
 * flags, so no GL resources are needed.
 */
export function createRenderPassStub() {
  return {
    clear: true,
    clearDepth: false,
    dispose: mock.fn()
  };
}
