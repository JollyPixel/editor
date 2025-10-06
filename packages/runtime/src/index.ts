// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { Loading } from "./components/Loading.js";
import * as timers from "./utils/timers.js";

import { Player, type PlayerOptions } from "./Player.js";

export interface LoadPlayerOptions {
  loadingDelay?: number;
}

export async function loadPlayer(
  player: Player,
  options: LoadPlayerOptions = {}
) {
  const { loadingDelay = 850 } = options;

  player.canvas.style.opacity = "0";
  player.canvas.style.transition = "opacity 0.5s ease-in";

  let loadingElement = document.querySelector("jolly-loading");
  if (loadingElement === null) {
    loadingElement = document.createElement("jolly-loading");
    document.body.appendChild(loadingElement);
  }
  const loadingComponent = loadingElement as Loading;
  loadingComponent.start();

  let loadingComplete = false;
  const loadingCompletePromise = new Promise((resolve) => {
    player.manager.onProgress = (_, loaded, total) => {
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
  player.canvas.addEventListener("keypress", (event) => {
    event.preventDefault();
  });

  // Make sure the focus is always on the game canvas wherever we click on the game window
  document.addEventListener("click", () => player.canvas.focus());

  try {
    if (loadingDelay > 0) {
      await timers.setTimeout(loadingDelay);
    }
    const context = { manager: player.manager };

    setTimeout(() => {
      Systems.Assets.autoload = true;
      Systems.Assets.scheduleAutoload(context);
    });
    await Systems.Assets.loadAssets(
      context,
      {
        onStart: loadingComponent.setAsset.bind(loadingComponent)
      }
    );

    await loadingCompletePromise;
    await loadingComponent.complete(() => {
      player.canvas.style.opacity = "1";
      player.start();
    });
  }
  catch (error: any) {
    loadingComponent.error(error);
  }
}

export { Player, type PlayerOptions };
