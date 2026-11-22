// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  AssetCoordinator,
  type AssetCatalog
} from "@jolly-pixel/asset";
import {
  Systems
} from "@jolly-pixel/ecs";
import { AnimationLoopFrameSource } from "@jolly-pixel/loop";
import type {
  RuntimeBackend,
  RuntimeSceneProgress
} from "@jolly-pixel/runtime";

// Import Internal Dependencies
import { createDefaultAssetLoaders } from "../assets/createDefaultAssetLoaders.ts";
import type { GlobalAudio } from "../audio/GlobalAudio.ts";
import type {
  ThreeRendererOptions,
  ThreeRenderer
} from "../rendering/ThreeRenderer.ts";
import { ThreeSceneGraph } from "../scene/ThreeSceneGraph.ts";
import {
  LazyCompressedTextureLoader
} from "../assets/loaders/LazyCompressedTextureLoader.ts";
import type { RuntimeAssetOptions } from "./RuntimeAssetOptions.ts";
import { loadSceneWithProgress } from "./loadSceneWithProgress.ts";
import { RendererMetrics } from "./RendererMetrics.ts";
import {
  mountViewHelper,
  type MountedViewHelper
} from "./viewHelper/mountViewHelper.ts";
import {
  ViewHelperSettings,
  type ViewHelperOptions
} from "./viewHelper/ViewHelperSettings.ts";

export interface ThreeRuntimeBackendOptions<TContext> {
  viewHelper?: boolean | ViewHelperOptions;
  context?: TContext;
  audio?: GlobalAudio;
  assets?: RuntimeAssetOptions;
  /**
   * Forwarded to `ThreeRenderer.create()`.
   */
  renderer?: ThreeRendererOptions;
}

export class ThreeRuntimeBackend<
  TContext = Systems.WorldDefaultContext
> implements RuntimeBackend<
  Systems.World<THREE.WebGPURenderer, TContext>,
  Systems.Scene<TContext>,
  RendererMetrics
> {
  readonly renderer: ThreeRenderer;
  readonly manager = new THREE.LoadingManager();
  readonly world: Systems.World<THREE.WebGPURenderer, TContext>;
  readonly frameSource: AnimationLoopFrameSource;
  readonly metrics: RendererMetrics;
  readonly viewHelper: ViewHelperSettings | null;

  #ktx2: LazyCompressedTextureLoader | undefined;
  #mountedViewHelper: MountedViewHelper | null = null;

  constructor(
    renderer: ThreeRenderer,
    catalog: AssetCatalog,
    logger: Systems.Logger,
    options: ThreeRuntimeBackendOptions<TContext> = {}
  ) {
    this.renderer = renderer;
    this.frameSource = new AnimationLoopFrameSource(renderer.source);
    this.metrics = new RendererMetrics(renderer.source);

    const ktx2 = options.assets?.ktx2;
    this.#ktx2 = ktx2 === undefined ?
      undefined :
      LazyCompressedTextureLoader.ktx2(
        this.manager,
        ktx2.transcoderPath,
        renderer.source
      );

    const world = new Systems.World<THREE.WebGPURenderer, TContext>(renderer, {
      enableOnExit: true,
      graph: new ThreeSceneGraph(),
      context: options.context,
      audio: options.audio,
      logger,
      assetCoordinator: new AssetCoordinator({
        catalog,
        loaders: createDefaultAssetLoaders(this.manager, {
          ktx2: this.#ktx2,
          loaders: options.assets?.loaders
        })
      })
    });
    this.world = world;

    const { viewHelper = false } = options;
    this.viewHelper = viewHelper === false ?
      null :
      new ViewHelperSettings(
        viewHelper === true ? {} : viewHelper,
        () => world.invalidate()
      );

    renderer.on("draw", this.#captureFrame);
    renderer.on("compiled", () => world.invalidate());
    renderer.on("deviceLost", (info) => {
      logger.error(
        "GPU device lost, reload the page to render again",
        { ...info }
      );
    });
  }

  adaptPixelRatio(
    ratio: number
  ): void {
    this.renderer.adaptPixelRatio(ratio);
  }

  loadScene(
    scene: Systems.Scene<TContext>,
    onProgress: (progress: RuntimeSceneProgress) => void
  ): Promise<void> {
    return loadSceneWithProgress(
      this.world.sceneManager,
      scene,
      onProgress
    );
  }

  start(): void {
    if (this.viewHelper !== null) {
      this.#mountedViewHelper = mountViewHelper(
        this.renderer,
        this.viewHelper
      );
    }
    this.world.connect().start();
  }

  stop(): void {
    this.world.stop();
    this.#mountedViewHelper?.dispose();
    this.#mountedViewHelper = null;
    this.world.disconnect();
  }

  dispose(): void {
    this.renderer.off("draw", this.#captureFrame);
    this.world.dispose();
    this.#ktx2?.dispose();
    this.#ktx2 = undefined;
  }

  readonly #captureFrame = (): void => {
    this.metrics.captureFrame();
  };
}
