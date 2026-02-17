// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
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
}

export async function loadRuntime(
  runtime: Runtime<any>,
  options: LoadRuntimeOptions = {}
) {
  const { loadingDelay = 850 } = options;

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
  document.addEventListener("click", () => runtime.canvas.focus());

  try {
    if (loadingDelay > 0) {
      await timers.setTimeout(loadingDelay);
    }

    const {
      fps,
      isMobile = false,
      tier
    } = await gpuTierPromise;

    runtime.loop.setFps(fps ?? 60);
    runtime.gameInstance.renderer.getSource().setPixelRatio(
      getDevicePixelRatio(isMobile)
    );
    if (tier < 1) {
      throw new Error("GPU is not powerful enough to run this game");
    }

    const context = { manager: runtime.manager };

    setTimeout(() => {
      Systems.Assets.autoload = true;
      Systems.Assets.scheduleAutoload(context);
    });
    const waitingAssetsCount = Systems.Assets.waiting.size;
    if (waitingAssetsCount > 0) {
      await Systems.Assets.loadAssets(
        context,
        {
          onStart: loadingComponent.setAsset.bind(loadingComponent)
        }
      );
      await loadingCompletePromise;
    }

    await loadingComponent.complete(() => {
      runtime.canvas.style.opacity = "1";
      runtime.start();
    });
  }
  catch (error: any) {
    loadingComponent.error(error);
  }
}

export { Runtime, type RuntimeOptions };
