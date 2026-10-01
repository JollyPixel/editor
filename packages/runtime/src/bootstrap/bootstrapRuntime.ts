// Import Third-party Dependencies
import type {
  AssetLoadProgress,
  AssetReference
} from "@jolly-pixel/asset";
import {
  Systems
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { Runtime } from "../Runtime.ts";
import { RuntimeLoadingScreen } from "../ui/RuntimeLoadingScreen.ts";
import {
  configureRuntimeDevice,
  type ConfigureRuntimeDeviceOptions
} from "./configureRuntimeDevice.ts";

export interface RuntimeBootstrapOptions extends ConfigureRuntimeDeviceOptions {
  logger?: Systems.Logger;
}

export interface RuntimeLoadOptions<
  TContext = Systems.WorldDefaultContext
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
  scene?: Systems.Scene<TContext>;
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

export async function bootstrapRuntime<
  TContext = Systems.WorldDefaultContext
>(
  runtime: Runtime<TContext>,
  options: RuntimeLoadOptions<TContext> = {},
  bootstrap: RuntimeBootstrapOptions = {}
): Promise<void> {
  const {
    loadingDelay = 850,
    loadingContainer = document.body,
    assets = [],
    scene,
    skipLoadingScreen = false,
    maxFps
  } = options;
  const {
    logger = new Systems.Logger(),
    ...device
  } = bootstrap;
  const deviceOptions = {
    ...device,
    maxFps
  };

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
        () => configureRuntimeDevice(runtime, deviceOptions)
      ),
      waitForLoadingDelay(skipLoadingScreen ? 0 : loadingDelay)
    ]);

    await logger.step(
      "assets",
      () => loadInitialAssets(runtime, loadingScreen, assets)
    );

    if (scene !== undefined) {
      await logger.step(
        "scene",
        () => loadInitialScene(
          runtime.world.sceneManager,
          loadingScreen,
          scene
        ),
        { scene: scene.name }
      );
    }

    await loadingScreen?.complete();
    runtime.start();
    traceFirstFrame(runtime, logger);
  }
  catch (value: unknown) {
    const error = toError(value);
    loadingScreen?.error(error);

    throw error;
  }
}

async function loadInitialAssets<TContext>(
  runtime: Runtime<TContext>,
  loadingScreen: RuntimeLoadingScreen | null,
  assets: Iterable<AssetReference<unknown>>
): Promise<void> {
  const batch = runtime.world.assetCoordinator.loadBatch(assets, {
    onProgress: (progress: AssetLoadProgress) => {
      loadingScreen?.update(progress);
    }
  });
  loadingScreen?.setProgress(
    batch.completed,
    batch.total
  );

  await batch.done;
}

async function loadInitialScene<TContext>(
  sceneManager: Systems.SceneManager<TContext>,
  loadingScreen: RuntimeLoadingScreen | null,
  scene: Systems.Scene<TContext>
): Promise<void> {
  const sceneLoad = sceneManager.loadScene(scene);

  function reportProgress(
    changedLoad: Systems.SceneLoad<TContext>
  ): void {
    if (changedLoad !== sceneLoad) {
      return;
    }

    loadingScreen?.setProgress(
      sceneLoad.completed,
      sceneLoad.total
    );
    if (sceneLoad.currentAsset !== null) {
      loadingScreen?.setAsset(sceneLoad.currentAsset);
    }
  }

  sceneManager.on("sceneLoadChanged", reportProgress);
  reportProgress(sceneLoad);

  try {
    await sceneLoad.done;
  }
  finally {
    sceneManager.off("sceneLoadChanged", reportProgress);
  }
}

function traceFirstFrame<TContext>(
  runtime: Runtime<TContext>,
  logger: Systems.Logger
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

function waitForLoadingDelay(
  delay: number
): Promise<void> {
  if (delay <= 0) {
    return Promise.resolve();
  }

  const {
    promise,
    resolve
  } = Promise.withResolvers<void>();
  window.setTimeout(resolve, delay);

  return promise;
}

function toError(
  value: unknown
): Error {
  return value instanceof Error ? value : new Error(String(value));
}
