// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  Renderer,
  RenderComponent,
  RendererEvents
} from "./Renderer.ts";
import {
  type RenderStrategy,
  DirectRenderStrategy
} from "./RenderStrategy.ts";

// CONSTANTS
const kDefaultMaxPixelRatio = 2;

export type ThreeRendererEvents = RendererEvents;

/**
 * Mutable `WebGPURenderer` state, applied after the GPU context exists.
 */
export interface ThreeRendererOutputOptions {
  /**
   * Device pixel ratio.
   * @default Math.min(window.devicePixelRatio, maxPixelRatio)
   */
  pixelRatio?: number;
  /**
   * Upper bound applied to `window.devicePixelRatio` when `pixelRatio` is omitted.
   * @default 2
   */
  maxPixelRatio?: number;
  /**
   * Shadow mapping. `false` disables it entirely.
   * @default false
   */
  shadows?: false | {
    /** @default THREE.PCFShadowMap */
    type?: THREE.ShadowMapType;
  };
  /**
   * @default THREE.SRGBColorSpace
   */
  outputColorSpace?: THREE.ColorSpace;
  /**
   * @default THREE.NeutralToneMapping
   */
  toneMapping?: THREE.ToneMapping;
  /**
   * @default 1.25
   */
  toneMappingExposure?: number;
}

export interface ThreeRendererOptions {
  /**
   * Forwarded to `new THREE.WebGPURenderer()`. These can only be chosen when the
   * GPU context is created — `antialias`, `powerPreference`, `alpha`,
   * `logarithmicDepthBuffer`, `stencil`, `forceWebGL`, …
   */
  webgpu?: Omit<THREE.WebGPURendererParameters, "canvas" | "context">;
  output?: ThreeRendererOutputOptions;
}

export interface ResolvedRendererSettings {
  webgpu: Omit<THREE.WebGPURendererParameters, "canvas" | "context">;
  pixelRatio: number;
  shadows: {
    enabled: boolean;
    type: THREE.ShadowMapType;
  };
  outputColorSpace: THREE.ColorSpace;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
}

export function resolveRendererSettings(
  options: Pick<ThreeRendererOptions, "webgpu" | "output"> = {},
  devicePixelRatio: number = globalThis.window?.devicePixelRatio ?? 1
): ResolvedRendererSettings {
  const { webgpu = {}, output = {} } = options;
  const {
    maxPixelRatio = kDefaultMaxPixelRatio,
    pixelRatio = Math.min(devicePixelRatio, maxPixelRatio),
    shadows = false,
    outputColorSpace = THREE.SRGBColorSpace,
    toneMapping = THREE.NeutralToneMapping,
    toneMappingExposure = 1.25
  } = output;

  return {
    webgpu: {
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      ...webgpu
    },
    pixelRatio,
    shadows: {
      enabled: shadows !== false,
      type: (shadows === false ? undefined : shadows.type) ?? THREE.PCFShadowMap
    },
    outputColorSpace,
    toneMapping,
    toneMappingExposure
  };
}

export class ThreeRenderer extends Emitter<ThreeRendererEvents> implements Renderer<THREE.WebGPURenderer> {
  webGPURenderer: THREE.WebGPURenderer;
  renderComponents: RenderComponent[] = [];
  renderStrategy: RenderStrategy;
  ratio: number | null = null;

  #sortedComponents: readonly RenderComponent[] = [];
  #renderOrderDirty = true;

  #resizeObserver: ResizeObserver | null = null;
  #width = 0;
  #height = 0;
  #resizeDirty = true;

  constructor(
    webGPURenderer: THREE.WebGPURenderer
  ) {
    super();
    this.webGPURenderer = webGPURenderer;
    this.renderStrategy = new DirectRenderStrategy(webGPURenderer);
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: ThreeRendererOptions = {}
  ): Promise<ThreeRenderer> {
    const webGPURenderer = await createWebGPURenderer(
      canvas,
      resolveRendererSettings(options)
    );

    return new ThreeRenderer(webGPURenderer);
  }

  get canvas() {
    return this.webGPURenderer.domElement;
  }

  getSource() {
    return this.webGPURenderer;
  }

  addRenderComponent(
    component: RenderComponent
  ): void {
    if (this.renderComponents.includes(component)) {
      return;
    }

    this.renderComponents.push(component);
    this.markRenderOrderDirty();
  }

  removeRenderComponent(
    component: RenderComponent
  ): void {
    const index = this.renderComponents.indexOf(component);
    if (index !== -1) {
      this.renderComponents.splice(index, 1);
      this.markRenderOrderDirty();
    }
  }

  markRenderOrderDirty(): void {
    this.#renderOrderDirty = true;
  }

  setRatio(
    ratio: number | null = null
  ) {
    this.ratio = ratio;

    const styles = this.ratio ?
      { margin: "0", flex: "1" } :
      { margin: "auto", flex: "none" };
    Object.assign(this.webGPURenderer.domElement.style, styles);
    this.resize();

    return this;
  }

  observeResize() {
    if (this.#resizeObserver) {
      return;
    }

    const target = this.ratio ?
      document.body :
      this.webGPURenderer.domElement.parentElement ?? this.webGPURenderer.domElement;

    this.#resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        this.#requestSize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    this.#resizeObserver.observe(target);
  }

  #requestSize(
    width: number,
    height: number
  ): void {
    if (!this.ratio) {
      this.#width = Math.round(width);
      this.#height = Math.round(height);
    }
    else if (width / height > this.ratio) {
      this.#height = Math.round(height);
      this.#width = Math.round(Math.min(width, height * this.ratio));
    }
    else {
      this.#width = Math.round(width);
      this.#height = Math.round(Math.min(height, width / this.ratio));
    }
    this.#resizeDirty = true;
  }

  unobserveResize() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
  }

  resize() {
    if (!this.#resizeDirty || this.#width === 0 || this.#height === 0) {
      return;
    }
    this.#resizeDirty = false;

    this.renderStrategy.resize(this.#width, this.#height);
    this.emit("resize", { width: this.#width, height: this.#height });
  }

  draw(
    scene: THREE.Scene
  ) {
    this.resize();

    if (this.#width === 0 || this.#height === 0) {
      return;
    }

    if (this.#renderOrderDirty) {
      this.#sortedComponents = [...this.renderComponents].sort(
        (a, b) => a.depth - b.depth
      );
      this.#renderOrderDirty = false;
    }

    this.renderStrategy.render(
      scene,
      {
        components: this.#sortedComponents,
        canvasWidth: this.#width,
        canvasHeight: this.#height
      }
    );
    this.emit("draw", { source: this.webGPURenderer });
  }

  clear() {
    this.webGPURenderer.clear();
  }

  dispose() {
    this.unobserveResize();
    this.renderStrategy.dispose();
    this.renderComponents.length = 0;
    this.#sortedComponents = [];

    this.webGPURenderer.setAnimationLoop(null);
    this.webGPURenderer.dispose();
  }
}

async function createWebGPURenderer(
  canvas: HTMLCanvasElement,
  settings: ResolvedRendererSettings
): Promise<THREE.WebGPURenderer> {
  const renderer = new THREE.WebGPURenderer({
    ...settings.webgpu,
    canvas
  });
  await renderer.init();

  renderer.setPixelRatio(settings.pixelRatio);
  renderer.shadowMap.enabled = settings.shadows.enabled;
  renderer.shadowMap.type = settings.shadows.type;
  renderer.setSize(0, 0, false);
  renderer.autoClear = false;
  renderer.outputColorSpace = settings.outputColorSpace;
  renderer.toneMapping = settings.toneMapping;
  renderer.toneMappingExposure = settings.toneMappingExposure;

  return renderer;
}
