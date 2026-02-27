// Import Third-party Dependencies
import { getGPUTier } from "detect-gpu";

// Import Internal Dependencies
import { Loading } from "./components/Loading.ts";
import * as timers from "./utils/timers.ts";
import { getDevicePixelRatio } from "./utils/getDevicePixelRatio.ts";

import { Runtime, type RuntimeOptions } from "./Runtime.ts";

export interface LoadRuntimeOptions {
  /**
   * @default 850
   * Minimum delay (ms) before starting asset loading. Gives the loading UI time to render.
   */
  loadingDelay?: number;
  /**
   * Whether to automatically focus the game canvas when the user clicks anywhere on the page.
   * This is important for games that require keyboard input,
   * as it ensures that the canvas has focus and can receive keyboard events.
   * @default true
   */
  focusCanvas?: boolean;
}

export async function loadRuntime(
  runtime: Runtime<any>,
  options: LoadRuntimeOptions = {}
) {
  const {
    loadingDelay = 850,
    focusCanvas = true
  } = options;

  const gpuTierPromise = getGPUTier();

  runtime.canvas.style.opacity = "0";
  runtime.canvas.style.transition = "opacity 0.5s ease-in";

  let loadingElement = document.querySelector("jolly-loading");
  if (loadingElement === null) {
    loadingElement = document.createElement("jolly-loading");
    document.body.appendChild(loadingElement);
  }
  const loadingComponent = loadingElement as Loading;
  loadingComponent.start();

  let loadingComplete = false;
  const loadingCompletePromise = new Promise((resolve) => {
    runtime.manager.onProgress = (_, loaded, total) => {
      loadingComponent.setProgress(loaded, total);

      if (loaded >= total && !loadingComplete) {
        loadingComplete = true;

        // Attendre un petit délai pour s'assurer que le DOM est mis à jour
        setTimeout(() => void resolve(undefined), 100);
      }
    };
  });

  // Prevent keypress events from leaking out to a parent window
  // They might trigger scrolling for instance
  runtime.canvas.addEventListener("keypress", (event) => {
    event.preventDefault();
  });

  // Make sure the focus is always on the game canvas wherever we click on the game window
  function focusCanvasHandler() {
    if (document.activeElement !== runtime.canvas) {
      runtime.canvas.focus();
    }
  }
  document.addEventListener("click", focusCanvasHandler);

  let initialized = false;
  try {
    if (loadingDelay > 0) {
      await timers.setTimeout(loadingDelay);
    }

    const {
      fps,
      isMobile = false,
      tier
    } = await gpuTierPromise;

    runtime.world.setFps(fps ?? 60);
    runtime.world.renderer.getSource().setPixelRatio(
      getDevicePixelRatio(isMobile)
    );
    if (tier < 1) {
      throw new Error("GPU is not powerful enough to run this game");
    }

    const assetManager = runtime.world.assetManager;

    setTimeout(() => {
      assetManager.autoload = true;
      assetManager.scheduleAutoload(assetManager.context);
    });
    const waitingAssetsCount = assetManager.waiting.size;
    if (waitingAssetsCount > 0) {
      await assetManager.loadAssets(
        assetManager.context,
        {
          onStart: loadingComponent.setAsset.bind(loadingComponent)
        }
      );

      // loadingCompletePromise resolves when the Three.js manager reports 100%.
      // Loaders that bypass the manager (e.g. bare fetch) never trigger onProgress,
      // so we force completion manually rather than hanging indefinitely.
      if (loadingComplete) {
        await loadingCompletePromise;
      }
      else {
        loadingComponent.setProgress(1, 1);
        await timers.setTimeout(100);
      }
    }

    await loadingComponent.complete();
    runtime.canvas.style.opacity = "1";
    initialized = true;
  }
  catch (error: any) {
    loadingComponent.error(error);
  }
  finally {
    if (!focusCanvas) {
      document.removeEventListener("click", focusCanvasHandler);
    }
  }

  if (initialized) {
    runtime.start();
  }
}

export { Runtime, type RuntimeOptions };
