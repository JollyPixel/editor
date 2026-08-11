// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  Renderer,
  RenderComponent,
  RendererEvents
} from "./Renderer.ts";
import type { WorldDefaultContext } from "../World.ts";
import type { SceneManager } from "../SceneManager.ts";
import {
  type RenderMode,
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
    /** @default THREE.PCFSoftShadowMap */
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

export interface ThreeRendererOptions<
  TContext = WorldDefaultContext
> {
  sceneManager: SceneManager<TContext>;
  /**
   * @default "direct"
   */
  renderMode?: RenderMode;
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

/**
 * Merges renderer options with the engine defaults. Pure and DOM-free so the
 * resulting configuration can be asserted without a GPU context.
 */
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
      type: (shadows === false ? undefined : shadows.type) ?? THREE.PCFSoftShadowMap
    },
    outputColorSpace,
    toneMapping,
    toneMappingExposure
  };
}

export class ThreeRenderer<
  TContext = WorldDefaultContext
> extends Emitter<ThreeRendererEvents> implements Renderer {
  webGPURenderer: THREE.WebGPURenderer;
  renderComponents: RenderComponent[] = [];
  renderStrategy: RenderStrategy;
  ratio: number | null = null;
  sceneManager: SceneManager<TContext>;

  #sortedComponents: readonly RenderComponent[] = [];
  #renderOrderDirty = true;

  #resizeObserver: ResizeObserver | null = null;
  #pendingResizeWidth = 0;
  #pendingResizeHeight = 0;
  #resizeDirty = true;

  private constructor(
    webGPURenderer: THREE.WebGPURenderer,
    options: ThreeRendererOptions<TContext>
  ) {
    super();
    const { sceneManager, renderMode = "direct" } = options;

    this.sceneManager = sceneManager;
    this.webGPURenderer = webGPURenderer;
    this.setRenderMode(renderMode);
  }

  /**
   * Builds and initializes a `ThreeRenderer`. `THREE.WebGPURenderer` requires
   * an asynchronous `init()` call before first use (it negotiates a WebGPU
   * adapter, falling back to a WebGL2 backend when WebGPU isn't available) —
   * this factory is the only way to obtain a ready-to-use instance.
   */
  static async create<
    TContext = WorldDefaultContext
  >(
    canvas: HTMLCanvasElement,
    options: ThreeRendererOptions<TContext>
  ): Promise<ThreeRenderer<TContext>> {
    const webGPURenderer = await createWebGPURenderer(
      canvas,
      resolveRendererSettings(options)
    );

    return new ThreeRenderer(webGPURenderer, options);
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

  /**
   * No-op in "direct" mode — direct rendering reads `threeCamera` fresh every
   * frame instead of caching a per-component render pass. Kept on the public
   * API so `CameraComponent.setProjectionMode` doesn't need to know whether
   * the active render mode cares.
   */
  updateRenderComponent(
    _component: RenderComponent
  ): void {
    // Nothing to rebind in direct mode.
  }

  markRenderOrderDirty(): void {
    this.#renderOrderDirty = true;
  }

  setRenderMode(
    mode: RenderMode
  ): this {
    if (mode !== "direct") {
      throw new Error(
        `ThreeRenderer: render mode "${mode}" is not supported yet — ` +
        "composer/post-processing needs to be rebuilt on WebGPURenderer's " +
        "node-based PostProcessing API. Use \"direct\"."
      );
    }

    this.renderStrategy?.dispose();
    this.renderStrategy = new DirectRenderStrategy(this.webGPURenderer);

    this.markRenderOrderDirty();
    this.#refreshRenderOrder();

    // The new strategy owns fresh render targets, so it must be sized even when
    // no ResizeObserver callback happened since the last resize.
    this.#resizeDirty = true;
    this.resize();

    // Guard: skip clear when the framebuffer still has zero dimensions
    // (e.g. at construction time before the first ResizeObserver callback).
    if (this.#pendingResizeWidth > 0 && this.#pendingResizeHeight > 0) {
      this.clear();
    }

    return this;
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
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      if (this.ratio) {
        if (width / height > this.ratio) {
          this.#pendingResizeHeight = Math.round(height);
          this.#pendingResizeWidth = Math.round(Math.min(width, height * this.ratio));
        }
        else {
          this.#pendingResizeWidth = Math.round(width);
          this.#pendingResizeHeight = Math.round(Math.min(height, width / this.ratio));
        }
      }
      else {
        this.#pendingResizeWidth = Math.round(width);
        this.#pendingResizeHeight = Math.round(height);
      }
      this.#resizeDirty = true;
    });
    this.#resizeObserver.observe(target);
  }

  unobserveResize() {
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }
  }

  resize() {
    if (!this.#resizeDirty) {
      return;
    }

    const width = this.#pendingResizeWidth;
    const height = this.#pendingResizeHeight;
    if (width === 0 || height === 0) {
      return;
    }
    this.#resizeDirty = false;

    this.renderStrategy.resize(width, height);
    this.emit("resize", { width, height });
  }

  draw() {
    this.resize();

    // Guard: skip draw when the framebuffer still has zero dimensions
    // (e.g. before the first ResizeObserver callback fires).
    if (this.#pendingResizeWidth === 0 || this.#pendingResizeHeight === 0) {
      return;
    }

    if (this.#renderOrderDirty) {
      this.#refreshRenderOrder();
    }

    this.renderStrategy.render(
      this.sceneManager.getSource(),
      {
        components: this.#sortedComponents,
        canvasWidth: this.#pendingResizeWidth,
        canvasHeight: this.#pendingResizeHeight
      }
    );
    this.emit("draw", { source: this.webGPURenderer });
  }

  onDraw(
    callback: (event: { source: THREE.WebGPURenderer; }) => void
  ) {
    this.on("draw", callback);
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

  #refreshRenderOrder(): void {
    this.#sortedComponents = [...this.renderComponents].sort(
      (a, b) => a.depth - b.depth
    );
    this.#renderOrderDirty = false;
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
  // DirectRenderStrategy owns clearing so multiple cameras can share a frame.
  renderer.autoClear = false;
  renderer.outputColorSpace = settings.outputColorSpace;
  renderer.toneMapping = settings.toneMapping;
  renderer.toneMappingExposure = settings.toneMappingExposure;

  return renderer;
}
