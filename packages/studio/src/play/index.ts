// Import Third-party Dependencies
import contributions from "virtual:jolly-pixel/contributions/runtime";
import { Systems } from "@jolly-pixel/ecs";
import { Runtime } from "@jolly-pixel/backend.three";
import { errorMessage } from "@jolly-pixel/utils";
import { GAME_URL_PATH, GAME_MANIFEST_META } from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  GameManifestClient,
  type Game
} from "./GameManifestClient.ts";
import { attachPhysics } from "./gamePhysics.ts";
import { PlayerScenes } from "./PlayerScenes.ts";
import { playLogger } from "./playLogger.ts";
import { contributedRuntimePackages } from "./runtimeContributions.ts";
import {
  PLAY_ERROR,
  PLAY_WARNING,
  type PlayReport
} from "./protocol.ts";

// CONSTANTS
const kCanvas = "#game-canvas";
const kStartParam = "start";
const kLoggedErrors = new WeakSet<object>();

function report(
  error: unknown
): void {
  const message = errorMessage(error);
  const failure = document.querySelector<HTMLElement>("#play-error");
  if (failure !== null) {
    failure.textContent = message;
    failure.hidden = false;
  }
  if (isObject(error) && kLoggedErrors.has(error)) {
    return;
  }

  console.error("[play]", error);
  tellOpener({
    type: PLAY_ERROR,
    message
  });
}

function isObject(
  value: unknown
): value is object {
  return typeof value === "object" && value !== null;
}

const logger = playLogger({
  search: location.search,
  warned: (message) => tellOpener({
    type: PLAY_WARNING,
    message
  }),
  failed: (message, cause) => {
    if (isObject(cause)) {
      kLoggedErrors.add(cause);
    }
    tellOpener({
      type: PLAY_ERROR,
      message
    });
  }
});

function tellOpener(
  data: PlayReport
): void {
  const opener: WindowProxy | null = window.opener;
  opener?.postMessage(data, location.origin);
}

async function loadGame(): Promise<Game> {
  if (document.querySelector(`meta[name="${GAME_MANIFEST_META}"]`) !== null) {
    return new GameManifestClient({
      url: new URL("./", document.baseURI)
    }).loadExported();
  }

  const start = new URLSearchParams(location.search).get(kStartParam);
  if (start === null || start === "") {
    throw new Error("No scene to play: press Play in the studio.");
  }

  const studioRoot = new URL("../", document.baseURI);

  return new GameManifestClient({
    url: new URL(`.${GAME_URL_PATH}`, studioRoot)
  }).load(start);
}

async function play(): Promise<void> {
  const game = await loadGame();
  const { components, loaders, usesPhysics } = Systems.contributedComponents(
    contributedRuntimePackages(contributions)
  );
  const runtime = await Runtime.create(kCanvas, {
    assets: {
      catalog: game.catalog,
      loaders
    },
    logger
  });
  runtime.manager.setURLModifier(game.resolveURL);
  const scenes = new PlayerScenes({
    files: runtime.world.assetCoordinator,
    catalog: game.catalog,
    components,
    physics: {
      uses: usesPhysics,
      attach: () => attachPhysics(runtime.world, game.physics)
    }
  });
  runtime.world.sceneManager.sceneSource = scenes;

  await runtime.load({
    scene: scenes.scene(game.start)
  });
}

window.addEventListener("error", (event) => report(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => report(event.reason));
play().catch(report);
