// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { AssetCatalog } from "@jolly-pixel/asset";
import {
  Systems,
  type GlobalAudio
} from "@jolly-pixel/engine";
import { AnimationLoopFrameSource } from "@jolly-pixel/loop";

// Import Internal Dependencies
import type {
  RuntimeBackend,
  RuntimeSceneProgress
} from "../core/contract/RuntimeBackend.ts";
import {
  createRuntimeAssetCoordinator
} from "./assets/createRuntimeAssetCoordinator.ts";
import {
  LazyCompressedTextureLoader
} from "./assets/LazyCompressedTextureLoader.ts";
import type { RuntimeAssetOptions } from "./assets/RuntimeAssetOptions.ts";
import { loadEngineScene } from "./loadEngineScene.ts";
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
   * Forwarded to `Systems.ThreeRenderer.create()`.
   */
  renderer?: Systems.ThreeRendererOptions;
}

export class ThreeRuntimeBackend<
  TContext = Systems.WorldDefaultContext
> implements RuntimeBackend<
  Systems.World<THREE.WebGPURenderer, TContext>,
  Systems.Scene<TContext>,
  RendererMetrics
> {
  readonly renderer: Systems.ThreeRenderer;
  readonly manager = new THREE.LoadingManager();
  readonly world: Systems.World<THREE.WebGPURenderer, TContext>;
  readonly frameSource: AnimationLoopFrameSource;
  readonly metrics: RendererMetrics;
  readonly viewHelper: ViewHelperSettings | null;

  #adaptivePixelRatio: boolean;
  #ktx2: LazyCompressedTextureLoader | null;
  #mountedViewHelper: MountedViewHelper | null = null;

  constructor(
    renderer: Systems.ThreeRenderer,
    catalog: AssetCatalog,
    logger: Systems.Logger,
    options: ThreeRuntimeBackendOptions<TContext> = {}
  ) {
    this.renderer = renderer;
    this.frameSource = new AnimationLoopFrameSource(renderer.getSource());
    this.metrics = new RendererMetrics(renderer.getSource());

    const output = options.renderer?.output;
    this.#adaptivePixelRatio = output?.pixelRatio === undefined &&
      output?.maxPixelRatio === undefined;

    const ktx2 = options.assets?.ktx2;
    this.#ktx2 = ktx2 === undefined ?
      null :
      LazyCompressedTextureLoader.ktx2(
        this.manager,
        ktx2,
        renderer.getSource()
      );

    const world = new Systems.World<THREE.WebGPURenderer, TContext>(renderer, {
      enableOnExit: true,
      sceneManager: new Systems.SceneManager<TContext>(),
      context: options.context,
      audio: options.audio,
      assetCoordinator: createRuntimeAssetCoordinator(
        this.manager,
        catalog,
        {
          loaders: options.assets?.loaders,
          ktx2: this.#ktx2 ?? undefined
        }
      )
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
    if (this.#adaptivePixelRatio) {
      this.renderer.getSource().setPixelRatio(ratio);
    }
  }

  loadScene(
    scene: Systems.Scene<TContext>,
    onProgress: (progress: RuntimeSceneProgress) => void
  ): Promise<void> {
    return loadEngineScene(
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
    this.world.input.exited = false;
    this.world.connect();
    this.world.start();
  }

  stop(): void {
    this.world.stop();
    this.world.input.exited = true;
    this.#mountedViewHelper?.dispose();
    this.#mountedViewHelper = null;
    this.world.disconnect();
  }

  dispose(): void {
    this.renderer.off("draw", this.#captureFrame);
    this.world.dispose();
    this.#ktx2?.dispose();
    this.#ktx2 = null;
  }

  readonly #captureFrame = (): void => {
    this.metrics.captureFrame();
  };
}
