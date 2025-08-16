// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { Loading } from "./components/Loading.js";

import { Player, type PlayerOptions } from "./Player.js";

export async function loadPlayer(
  player: Player
) {
  // Prevent keypress events from leaking out to a parent window
  // They might trigger scrolling for instance
  player.canvas.addEventListener("keypress", (event) => {
    event.preventDefault();
  });

  // Make sure the focus is always on the game canvas wherever we click on the game window
  document.addEventListener("click", () => player.canvas.focus());

  let loadingElement = document.querySelector("jolly-loading");
  if (loadingElement === null) {
    loadingElement = document.createElement("jolly-loading");
    document.body.appendChild(loadingElement);
  }

  const loadingComponent = loadingElement as Loading;

  loadingComponent.start();
  try {
    await new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });
    await Systems.Assets.loadAll(
      { manager: player.manager },
      loadingComponent.setProgress.bind(loadingComponent)
    );
    loadingComponent.complete(() => player.start());
  }
  catch (error: any) {
    console.error("Error loading assets:", error);
    loadingComponent.error(error);
  }
}

export { Player, type PlayerOptions };
