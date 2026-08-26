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
import { configureRuntimeDevice } from "./configureRuntimeDevice.ts";

export interface LoadRuntimeOptions<
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

export async function loadRuntime<
  TContext = Systems.WorldDefaultContext
>(
  runtime: Runtime<TContext>,
  options: LoadRuntimeOptions<TContext> = {}
): Promise<void> {
  const {
    loadingDelay = 850,
    loadingContainer = document.body,
    assets = [],
    scene,
    skipLoadingScreen = false,
    maxFps
  } = options;

  if (skipLoadingScreen) {
    runtime.canvas.style.opacity = "1";

    await configureRuntimeDevice(runtime, { maxFps });
    await loadInitialAssets(runtime, null, assets);

    if (scene !== undefined) {
      await loadInitialScene(runtime.world.sceneManager, null, scene);
    }

    runtime.start();

    return;
  }

  const loadingScreen = RuntimeLoadingScreen.mount(
    runtime.canvas,
    loadingContainer
  );

  try {
    await Promise.all([
      loadingScreen.start(),
      configureRuntimeDevice(runtime, { maxFps }),
      waitForLoadingDelay(loadingDelay)
    ]);

    await loadInitialAssets(
      runtime,
      loadingScreen,
      assets
    );

    if (scene !== undefined) {
      await loadInitialScene(
        runtime.world.sceneManager,
        loadingScreen,
        scene
      );
    }

    await loadingScreen.complete();
    runtime.start();
  }
  catch (value: unknown) {
    const error = toError(value);
    loadingScreen.error(error);

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

function loadInitialScene<TContext>(
  sceneManager: Systems.SceneManager<TContext>,
  loadingScreen: RuntimeLoadingScreen | null,
  scene: Systems.Scene<TContext>
): Promise<void> {
  const sceneLoad = sceneManager.loadScene(scene);
  const {
    promise,
    resolve,
    reject
  } = Promise.withResolvers<void>();

  function handleChange(
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

    if (
      sceneLoad.status === "ready" ||
      sceneLoad.status === "active"
    ) {
      sceneManager.off(
        "sceneLoadChanged",
        handleChange
      );
      resolve();
    }
    else if (sceneLoad.status === "failed") {
      sceneManager.off(
        "sceneLoadChanged",
        handleChange
      );
      reject(sceneLoad.error);
    }
    else if (sceneLoad.status === "cancelled") {
      sceneManager.off(
        "sceneLoadChanged",
        handleChange
      );
      reject(new Error("Initial scene loading was cancelled."));
    }
  }

  sceneManager.on(
    "sceneLoadChanged",
    handleChange
  );
  handleChange(sceneLoad);

  return promise;
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
