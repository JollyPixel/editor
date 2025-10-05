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

  let loadingElement = document.querySelector("jolly-loading");
  if (loadingElement === null) {
    loadingElement = document.createElement("jolly-loading");
    document.body.appendChild(loadingElement);
  }
  const loadingComponent = loadingElement as Loading;

  loadingComponent.start();

  const manager = player.manager;
  manager.onLoad = () => {
    setTimeout(() => {
      loadingComponent.complete(() => player.start());
    }, loadingDelay);
  };
  manager.onProgress = (_, loaded, total) => {
    loadingComponent.setProgress(loaded, total);
  };

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
    const context = { manager };

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
  }
  catch (error: any) {
    loadingComponent.error(error);
  }
}

export { Player, type PlayerOptions };
