// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import { getGPUTier } from "detect-gpu";

// Import Internal Dependencies
import * as timers from "./utils/timers.ts";
import { getDevicePixelRatio } from "./utils/getDevicePixelRatio.ts";
import { Runtime, type RuntimeOptions } from "./Runtime.ts";
import { DefaultSplashScreen } from "./splash/DefaultSplashScreen.ts";
import type { SplashScreen } from "./splash/SplashScreen.ts";

export interface LoadRuntimeOptions {
  /**
   * @default 850
   * Minimum delay (ms) before starting asset loading. Gives the splash screen
   * at least one full render cycle before any heavy work begins.
   */
  loadingDelay?: number;
  /**
   * Whether to automatically focus the game canvas when the user clicks anywhere on the page.
   * This is important for games that require keyboard input,
   * as it ensures that the canvas has focus and can receive keyboard events.
   * @default true
   */
  focusCanvas?: boolean;

  /**
   * Custom splash screen to use instead of the built-in DefaultSplashScreen.
   * Pass either a SplashScreen instance or a factory function (created lazily,
   * after Runtime is constructed).
   *
   * @example
   * // Instance
   * await loadRuntime(runtime, { splashScreen: new MyBrandedSplash() });
   *
   * // Factory (created lazily)
   * await loadRuntime(runtime, { splashScreen: () => new MyBrandedSplash() });
   */
  splashScreen?: SplashScreen | (() => SplashScreen);
}

export async function loadRuntime(
  runtime: Runtime<any>,
  options: LoadRuntimeOptions = {}
) {
  const {
    loadingDelay = 850,
    focusCanvas = true,
    splashScreen: splashFactory
  } = options;

  const gpuTierPromise = getGPUTier();

  let splash: SplashScreen;
  if (splashFactory === undefined) {
    splash = new DefaultSplashScreen();
  }
  else if (typeof splashFactory === "function") {
    splash = splashFactory();
  }
  else {
    splash = splashFactory;
  }

  // Append the splash scene as an overlay so the engine lifecycle is available
  // throughout loading, then start the animation loop immediately.
  runtime.world.sceneManager.appendScene(splash.scene);
  runtime.start();

  // Allow the splash scene's start() to run and let onSetup perform any
  // world-connected setup (e.g. texture loading).
  splash.onSetup(runtime.world);

  // Prevent keypress events from leaking out to a parent window
  // (they might trigger scrolling for instance).
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

  let loadingComplete = false;
  const loadingCompletePromise = new Promise<void>((resolve) => {
    runtime.manager.onProgress = (_, loaded, total) => {
      splash.onProgress(loaded, total);

      if (loaded >= total && !loadingComplete) {
        loadingComplete = true;

        // Short delay to ensure the DOM has updated before resolving.
        setTimeout(() => resolve(), 100);
      }
    };
  });

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

    const context = { manager: runtime.manager };

    setTimeout(() => {
      Systems.Assets.autoload = true;
      Systems.Assets.scheduleAutoload(context);
    });

    if (Systems.Assets.waiting.size > 0) {
      await Systems.Assets.loadAssets(
        context,
        {
          onStart: (asset) => splash.onAssetStart(asset)
        }
      );

      // loadingCompletePromise resolves when the Three.js manager reports 100 %.
      // Loaders that bypass the manager (e.g. bare fetch) never trigger onProgress,
      // so we force completion manually rather than hanging indefinitely.
      if (loadingComplete) {
        await loadingCompletePromise;
      }
      else {
        splash.onProgress(1, 1);
        await timers.setTimeout(100);
      }
    }

    splash.onLoadComplete();
    await splash.waitForUserGesture();
    await splash.complete();
  }
  catch (error: any) {
    splash.onError(error);
  }
  finally {
    if (!focusCanvas) {
      document.removeEventListener("click", focusCanvasHandler);
    }
  }
}

export { Runtime, type RuntimeOptions };
export type { SplashScreen };
export { DefaultSplashScreen };
