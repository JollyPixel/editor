// Import Third-party Dependencies
import type {
  AssetCoordinator,
  AssetReference
} from "@jolly-pixel/asset";
import type { GameLoop } from "@jolly-pixel/loop";
import { asError } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  RuntimeBackend,
  RuntimeWorld
} from "../contract/RuntimeBackend.ts";
import type { RuntimeLogger } from "../contract/RuntimeLogger.ts";
import {
  RuntimeLoadingScreen,
  type LoadingScreen
} from "./RuntimeLoadingScreen.ts";
import { configureRuntimeDevice } from "./configureRuntimeDevice.ts";

export interface RuntimeStartupHost {
  readonly canvas: HTMLCanvasElement;
  readonly loop: Pick<GameLoop, "scheduler">;
  readonly world: Pick<RuntimeWorld, "assetCoordinator">;
}

export type RuntimeStartupBackend<TScene> = Pick<
  RuntimeBackend<RuntimeWorld, TScene>,
  "adaptPixelRatio" | "loadScene"
>;

export interface RuntimeCoreLoadOptions<
  TScene = unknown
> {
  /**
   * Minimum time in milliseconds for which the loading screen is shown.
   * @default 850
   */
  loadingDelay?: number;
  /**
   * Element that contains the loading screen.
   * @default document.body
   */
  loadingContainer?: HTMLElement;
  /**
   * Additional asset references to load before starting the runtime.
   */
  assets?: Iterable<AssetReference<unknown>>;
  /**
   * Initial scene to prepare and queue before starting the runtime.
   */
  scene?: TScene;
  /**
   * Skip mounting the loading screen entirely
   * @default false
   */
  skipLoadingScreen?: boolean;
  /**
   * Render cap in frames per second, overriding the GPU-benchmarked estimate.
   * @see ConfigureRuntimeDeviceOptions
   */
  maxFps?: number;
}

export async function prepareRuntime<TScene>(
  runtime: RuntimeStartupHost,
  backend: RuntimeStartupBackend<TScene>,
  logger: RuntimeLogger,
  options: RuntimeCoreLoadOptions<TScene> = {}
): Promise<void> {
  const {
    loadingDelay = 850,
    loadingContainer = document.body,
    assets = [],
    scene,
    skipLoadingScreen = false,
    maxFps
  } = options;

  const screen = skipLoadingScreen ?
    RuntimeLoadingScreen.skip(runtime.canvas) :
    RuntimeLoadingScreen.mount(
      runtime.canvas,
      loadingContainer,
      loadingDelay
    );

  try {
    await Promise.all([
      screen.start(),
      logger.step(
        "device",
        () => configureRuntimeDevice(
          runtime.loop,
          backend,
          logger,
          { maxFps }
        )
      )
    ]);

    await logger.step(
      "assets",
      () => loadInitialAssets(
        runtime.world.assetCoordinator,
        screen,
        assets
      )
    );

    if (scene !== undefined) {
      await logger.step(
        "scene",
        () => backend.loadScene(
          scene,
          (progress) => screen.progress(progress, progress.currentAsset)
        )
      );
    }

    await screen.complete();
  }
  catch (value: unknown) {
    const error = asError(value);
    screen.error(error);

    throw error;
  }
}

async function loadInitialAssets(
  coordinator: AssetCoordinator,
  screen: LoadingScreen,
  assets: Iterable<AssetReference<unknown>>
): Promise<void> {
  const batch = coordinator.loadBatch(assets, {
    onProgress: (progress) => screen.progress(progress, progress.record)
  });
  screen.progress(batch, null);

  await batch.done;
}
