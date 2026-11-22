// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Emitter } from "@openally/emitt";
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { ThreeSceneGraph } from "../scene/ThreeSceneGraph.ts";
import type { ThreeRenderComponent } from "./ThreeRenderComponent.ts";
import { CameraCompositor } from "./compositing/CameraCompositor.ts";
import { PipelineCompiles } from "./PipelineCompiles.ts";

// CONSTANTS
const kDefaultMaxPixelRatio = 2;

export interface RendererDeviceLost {
  api: "WebGL" | "WebGPU";
  message: string;
  reason: string | null;
}

export type ThreeRendererEvents = Systems.RendererEvents<THREE.WebGPURenderer> & {
  deviceLost: (
    info: RendererDeviceLost
  ) => void;
};

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
    /**
     * @default THREE.PCFShadowMap
     */
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
   * GPU context is created: `antialias`, `powerPreference`, `alpha`,
   * `logarithmicDepthBuffer`, `stencil`, `forceWebGL`, …
   */
  webgpu?: Omit<THREE.WebGPURendererParameters, "canvas" | "context">;
  output?: ThreeRendererOutputOptions;
}

export interface ThreeRendererConstructorOptions {
  /**
   * Lets `adaptPixelRatio()` change the pixel ratio.
   * @default false
   */
  adaptivePixelRatio?: boolean;
}

export interface ResolvedRendererSettings {
  webgpu: Omit<THREE.WebGPURendererParameters, "canvas" | "context">;
  pixelRatio: number;
  /**
   * The pixel ratio follows the runtime's adaptive quality, true when
   * neither `pixelRatio` nor `maxPixelRatio` is set.
   */
  adaptivePixelRatio: boolean;
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
    adaptivePixelRatio: output.pixelRatio === undefined &&
      output.maxPixelRatio === undefined,
    shadows: {
      enabled: shadows !== false,
      type: (shadows === false ? undefined : shadows.type) ?? THREE.PCFShadowMap
    },
    outputColorSpace,
    toneMapping,
    toneMappingExposure
  };
}

export class ThreeRenderer extends Emitter<ThreeRendererEvents>
  implements Systems.Renderer<THREE.WebGPURenderer> {
  #source: THREE.WebGPURenderer;

  #compositor: CameraCompositor;
  #size = new Systems.CanvasSize();
  #resizeObserver: ResizeObserver | null = null;
  #compiles: PipelineCompiles | null = null;
  #adaptivePixelRatio: boolean;

  constructor(
    webGPURenderer: THREE.WebGPURenderer,
    options: ThreeRendererConstructorOptions = {}
  ) {
    super();
    this.#source = webGPURenderer;
    this.#adaptivePixelRatio = options.adaptivePixelRatio ?? false;
    this.#compositor = new CameraCompositor(webGPURenderer);

    const { backend } = webGPURenderer;
    if (PipelineCompiles.isBackend(backend)) {
      this.#compiles = new PipelineCompiles(
        backend,
        () => this.emit("compiled")
      );
    }

    const onDeviceLost = webGPURenderer.onDeviceLost;
    webGPURenderer.onDeviceLost = (info) => {
      onDeviceLost.call(webGPURenderer, info);
      this.emit("deviceLost", {
        api: info.api,
        message: info.message,
        reason: info.reason
      });
    };
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: ThreeRendererOptions = {}
  ): Promise<ThreeRenderer> {
    const settings = resolveRendererSettings(options);
    const webGPURenderer = await createWebGPURenderer(canvas, settings);

    return new ThreeRenderer(webGPURenderer, {
      adaptivePixelRatio: settings.adaptivePixelRatio
    });
  }

  adaptPixelRatio(
    ratio: number
  ): void {
    if (this.#adaptivePixelRatio) {
      this.#source.setPixelRatio(ratio);
    }
  }

  get canvas() {
    return this.#source.domElement;
  }

  get ratio(): number | null {
    return this.#size.layout.ratio;
  }

  get renderComponents(): readonly ThreeRenderComponent[] {
    return this.#compositor.components;
  }

  get source(): THREE.WebGPURenderer {
    return this.#source;
  }

  get pendingCompiles(): number {
    return this.#compiles?.pending ?? 0;
  }

  compiled(): Promise<void> {
    return this.#compiles?.settled() ?? Promise.resolve();
  }

  addRenderComponent(
    component: ThreeRenderComponent
  ): void {
    this.#compositor.add(component);
  }

  removeRenderComponent(
    component: ThreeRenderComponent
  ): void {
    this.#compositor.remove(component);
  }

  lockAspectRatio(
    ratio: number
  ) {
    return this.#fit(ratio);
  }

  unlockAspectRatio() {
    return this.#fit(null);
  }

  #fit(
    ratio: number | null
  ): this {
    this.#size.layout = Systems.createCanvasFit(ratio);
    Object.assign(
      this.#source.domElement.style,
      this.#size.layout.styles
    );
    this.resize();

    return this;
  }

  observeResize() {
    if (this.#resizeObserver) {
      return;
    }

    const target = this.#size.layout.observeTarget(
      this.#source.domElement
    );
    this.#resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        this.#size.fit(entry.contentRect.width, entry.contentRect.height);
      }
    });
    this.#resizeObserver.observe(target);
  }

  unobserveResize() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
  }

  resize() {
    const size = this.#size.commit();
    if (size === null) {
      return;
    }

    this.#source.setSize(size.width, size.height, false);
    this.emit("resize", size);
  }

  draw(
    graph: ThreeSceneGraph
  ) {
    this.resize();

    const canvas = this.#size.dimensions;
    if (canvas.isEmpty) {
      return;
    }

    this.#compositor.render(graph.scene, canvas, graph.postProcessing);
    this.emit("draw", { source: this.#source });
  }

  clear() {
    this.#source.clear();
  }

  dispose() {
    this.unobserveResize();
    this.#compositor.dispose();

    this.#source.setAnimationLoop(null);
    this.#source.dispose();
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
