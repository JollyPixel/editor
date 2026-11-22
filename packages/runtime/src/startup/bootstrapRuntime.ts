// Import Third-party Dependencies
import type {
  AssetLoadProgress,
  AssetReference
} from "@jolly-pixel/asset";
import type { GameLoop } from "@jolly-pixel/loop";
import { asError, delay } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  RuntimeBackend,
  RuntimeSceneProgress,
  RuntimeWorld
} from "../contract/RuntimeBackend.ts";
import {
  SilentLogger,
  type RuntimeLogger
} from "../contract/RuntimeLogger.ts";
import { RuntimeLoadingScreen } from "./RuntimeLoadingScreen.ts";
import { configureRuntimeDevice } from "./configureRuntimeDevice.ts";

export interface RuntimeBootstrapHost {
  readonly canvas: HTMLCanvasElement;
  readonly loop: Pick<GameLoop, "scheduler">;
  readonly world: Pick<RuntimeWorld, "assetCoordinator">;
  start(): void;
  nextFrame(): Promise<void>;
}

export type RuntimeBootstrapBackend<TScene> = Pick<
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

export async function bootstrapRuntime<TScene>(
  runtime: RuntimeBootstrapHost,
  backend: RuntimeBootstrapBackend<TScene>,
  options: RuntimeCoreLoadOptions<TScene> = {},
  logger: RuntimeLogger = new SilentLogger()
): Promise<void> {
  const {
    loadingDelay = 850,
    loadingContainer = document.body,
    assets = [],
    scene,
    skipLoadingScreen = false,
    maxFps
  } = options;

  let loadingScreen: RuntimeLoadingScreen | null = null;
  if (skipLoadingScreen) {
    runtime.canvas.style.opacity = "1";
  }
  else {
    loadingScreen = RuntimeLoadingScreen.mount(
      runtime.canvas,
      loadingContainer
    );
  }

  try {
    await Promise.all([
      loadingScreen?.start(),
      logger.step(
        "device",
        () => configureRuntimeDevice(
          runtime.loop,
          backend,
          { maxFps }
        )
      ),
      delay(skipLoadingScreen ? 0 : loadingDelay)
    ]);

    await logger.step(
      "assets",
      () => loadInitialAssets(runtime, loadingScreen, assets)
    );

    if (scene !== undefined) {
      await logger.step(
        "scene",
        () => backend.loadScene(
          scene,
          (progress) => reportSceneProgress(loadingScreen, progress)
        )
      );
    }

    await loadingScreen?.complete();
    runtime.start();
    traceFirstFrame(runtime, logger);
  }
  catch (value: unknown) {
    const error = asError(value);
    loadingScreen?.error(error);

    throw error;
  }
}

async function loadInitialAssets(
  runtime: RuntimeBootstrapHost,
  loadingScreen: RuntimeLoadingScreen | null,
  assets: Iterable<AssetReference<unknown>>
): Promise<void> {
  const batch = runtime.world.assetCoordinator.loadBatch(assets, {
    onProgress: (progress: AssetLoadProgress) => {
      loadingScreen?.update(progress);
    }
  });
  loadingScreen?.updateProgress(
    batch.completed,
    batch.total
  );

  await batch.done;
}

function reportSceneProgress(
  loadingScreen: RuntimeLoadingScreen | null,
  progress: RuntimeSceneProgress
): void {
  loadingScreen?.updateProgress(
    progress.completed,
    progress.total
  );
  if (progress.currentAsset !== null) {
    loadingScreen?.showAsset(progress.currentAsset);
  }
}

function traceFirstFrame(
  runtime: RuntimeBootstrapHost,
  logger: RuntimeLogger
): void {
  if (!logger.isNamespaceEnabled()) {
    return;
  }

  logger.debug("waiting for first frame", {
    visibility: document.visibilityState
  });
  void runtime.nextFrame().then(
    () => logger.debug("first frame")
  );
}
