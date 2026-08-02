// Import Third-party Dependencies
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import type { Pass } from "three/addons/postprocessing/Pass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { EventEmitter } from "@posva/event-emitter";

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
  DirectRenderStrategy,
  ComposerRenderStrategy,
  orderRenderPasses
} from "./RenderStrategy.ts";
import { Logger } from "../Logger.ts";

// CONSTANTS
const kDefaultMaxPixelRatio = 2;
const kLoggerNamespace = "Systems.Renderer";

export type ThreeRendererEvents = RendererEvents;

/**
 * Mutable `WebGLRenderer` state, applied after the GL context exists.
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
   * Forwarded to `new THREE.WebGLRenderer()`. These can only be chosen when the
   * GL context is created — `antialias`, `powerPreference`, `alpha`,
   * `logarithmicDepthBuffer`, `stencil`, …
   */
  webgl?: Omit<THREE.WebGLRendererParameters, "canvas" | "context">;
  output?: ThreeRendererOutputOptions;
  /**
   * Destination for renderer warnings. Defaults to a logger that prints
   * warnings; pass an application logger to route or silence them.
   */
  logger?: Logger;
}

export interface ResolvedRendererSettings {
  webgl: Omit<THREE.WebGLRendererParameters, "canvas" | "context">;
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
 * resulting configuration can be asserted without a GL context.
 */
export function resolveRendererSettings(
  options: Pick<ThreeRendererOptions, "webgl" | "output"> = {},
  devicePixelRatio: number = globalThis.window?.devicePixelRatio ?? 1
): ResolvedRendererSettings {
  const { webgl = {}, output = {} } = options;
  const {
    maxPixelRatio = kDefaultMaxPixelRatio,
    pixelRatio = Math.min(devicePixelRatio, maxPixelRatio),
    shadows = false,
    outputColorSpace = THREE.SRGBColorSpace,
    toneMapping = THREE.NeutralToneMapping,
    toneMappingExposure = 1.25
  } = output;

  return {
    webgl: {
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      ...webgl
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
> extends EventEmitter<ThreeRendererEvents> implements Renderer {
  webGLRenderer: THREE.WebGLRenderer;
  renderComponents: RenderComponent[] = [];
  renderStrategy: RenderStrategy;
  ratio: number | null = null;
  sceneManager: SceneManager<TContext>;

  readonly #logger: Logger;
  /**
   * RenderPass owned by this renderer for each component, keyed by component so
   * a component swapping its `threeCamera` does not orphan its pass.
   */
  #passes = new Map<RenderComponent, RenderPass>();
  #sortedComponents: readonly RenderComponent[] = [];
  #renderOrderDirty = true;
  #viewportWarningIssued = false;

  #resizeObserver: ResizeObserver | null = null;
  #pendingResizeWidth = 0;
  #pendingResizeHeight = 0;
  #resizeDirty = true;

  constructor(
    canvas: HTMLCanvasElement,
    options: ThreeRendererOptions<TContext>
  ) {
    super();
    const { sceneManager, renderMode = "direct" } = options;

    this.sceneManager = sceneManager;
    this.#logger = (
      options.logger ?? new Logger({ level: "warn", namespaces: ["*"] })
    ).child({ namespace: kLoggerNamespace });
    this.webGLRenderer = createWebGLRenderer(
      canvas,
      resolveRendererSettings(options)
    );
    this.setRenderMode(renderMode);
  }

  get canvas() {
    return this.webGLRenderer.domElement;
  }

  getSource() {
    return this.webGLRenderer;
  }

  addRenderComponent(
    component: RenderComponent
  ): void {
    if (this.renderComponents.includes(component)) {
      return;
    }

    this.renderComponents.push(component);
    this.markRenderOrderDirty();

    if (this.renderStrategy instanceof ComposerRenderStrategy) {
      const renderPass = new RenderPass(
        this.sceneManager.getSource(),
        component.threeCamera
      );
      this.#passes.set(component, renderPass);
      this.renderStrategy.addEffect(renderPass);
      this.#refreshRenderOrder();
    }
  }

  removeRenderComponent(
    component: RenderComponent
  ): void {
    const index = this.renderComponents.indexOf(component);
    if (index !== -1) {
      this.renderComponents.splice(index, 1);
      this.markRenderOrderDirty();
    }

    const renderPass = this.#passes.get(component);
    if (renderPass) {
      this.#passes.delete(component);
      if (this.renderStrategy instanceof ComposerRenderStrategy) {
        this.renderStrategy.removeEffect(renderPass);
        this.#refreshRenderOrder();
      }
      renderPass.dispose();
    }
  }

  updateRenderComponent(
    component: RenderComponent
  ): void {
    const renderPass = this.#passes.get(component);
    if (renderPass) {
      renderPass.camera = component.threeCamera;
    }
  }

  markRenderOrderDirty(): void {
    this.#renderOrderDirty = true;
  }

  setRenderMode(
    mode: RenderMode
  ): this {
    this.renderStrategy?.dispose();
    this.#passes.clear();

    if (mode === "direct") {
      this.renderStrategy = new DirectRenderStrategy(this.webGLRenderer);
    }
    else {
      const strategy = new ComposerRenderStrategy(
        this.webGLRenderer,
        new EffectComposer(this.webGLRenderer)
      );

      const scene = this.sceneManager.getSource();
      for (const renderComponent of this.renderComponents) {
        const renderPass = new RenderPass(scene, renderComponent.threeCamera);
        this.#passes.set(renderComponent, renderPass);
        strategy.addEffect(renderPass);
      }
      this.renderStrategy = strategy;
    }

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

  setEffects(
    ...effects: Pass[]
  ): this {
    if (!(this.renderStrategy instanceof ComposerRenderStrategy)) {
      this.#logger.warn(
        "setEffects called in direct render mode — effects are ignored. Call setRenderMode(\"composer\") first."
      );

      return this;
    }

    // Drop every pass except the RenderPasses this renderer owns for its components.
    const owned = new Set<Pass>(this.#passes.values());
    const composer = this.renderStrategy.getComposer();
    for (const pass of [...composer.passes]) {
      if (!owned.has(pass)) {
        this.renderStrategy.removeEffect(pass);
        pass.dispose();
      }
    }

    for (const pass of effects) {
      this.renderStrategy.addEffect(pass);
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
    Object.assign(this.webGLRenderer.domElement.style, styles);
    this.resize();

    return this;
  }

  observeResize() {
    if (this.#resizeObserver) {
      return;
    }

    const target = this.ratio ?
      document.body :
      this.webGLRenderer.domElement.parentElement ?? this.webGLRenderer.domElement;

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
    this.emit("draw", { source: this.webGLRenderer });
  }

  onDraw(
    callback: (event: { source: THREE.WebGLRenderer; }) => void
  ) {
    this.on("draw", callback);
  }

  clear() {
    this.webGLRenderer.clear();
  }

  dispose() {
    this.unobserveResize();
    this.renderStrategy.dispose();
    this.#passes.clear();
    this.renderComponents.length = 0;
    this.#sortedComponents = [];

    this.webGLRenderer.setAnimationLoop(null);
    this.webGLRenderer.dispose();
    this.webGLRenderer.forceContextLoss();
  }

  #refreshRenderOrder(): void {
    this.#sortedComponents = [...this.renderComponents].sort(
      (a, b) => a.depth - b.depth
    );
    this.#renderOrderDirty = false;

    if (this.renderStrategy instanceof ComposerRenderStrategy) {
      this.#syncComposerPasses(this.renderStrategy);
    }
  }

  #syncComposerPasses(
    strategy: ComposerRenderStrategy
  ): void {
    strategy.setPassOrder(
      orderRenderPasses(this.#sortedComponents, this.#passes)
    );

    for (const component of this.#sortedComponents) {
      this.#warnUnsupportedViewport(component);
    }
  }

  #warnUnsupportedViewport(
    component: RenderComponent
  ): void {
    if (component.viewport === null || this.#viewportWarningIssued) {
      return;
    }

    this.#viewportWarningIssued = true;
    this.#logger.warn(
      "composer mode ignores per-camera viewports and renders full-canvas. " +
      "Use renderMode \"direct\" for split-screen or layered viewport cameras."
    );
  }
}

function createWebGLRenderer(
  canvas: HTMLCanvasElement,
  settings: ResolvedRendererSettings
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    ...settings.webgl,
    canvas
  });

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
