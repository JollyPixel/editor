// Import Third-party Dependencies
import contributions from "virtual:jolly-pixel/contributions/runtime";
import {
  Runtime,
  contributedRuntimeComponents
} from "@jolly-pixel/runtime";
import { errorMessage } from "@jolly-pixel/utils";
import { GAME_URL_PATH, GAME_MANIFEST_META } from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  GameManifestClient,
  type Game
} from "./GameManifestClient.ts";
import { GameScenes } from "./GameScenes.ts";
import { playLoggerOptions } from "./playLogger.ts";
import {
  PLAY_ERROR,
  PLAY_WARNING,
  type PlayReport
} from "./protocol.ts";

// CONSTANTS
const kCanvas = "#game-canvas";
const kStartParam = "start";

function report(
  error: unknown
): void {
  const message = errorMessage(error);
  console.error("[play]", error);
  const failure = document.querySelector<HTMLElement>("#play-error");
  if (failure !== null) {
    failure.textContent = message;
    failure.hidden = false;
  }
  tellOpener({
    type: PLAY_ERROR,
    message
  });
}

function warn(
  message: string
): void {
  tellOpener({
    type: PLAY_WARNING,
    message
  });
}

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
  const { components, loaders, setup } = contributedRuntimeComponents(
    contributions
  );
  const runtime = await Runtime.create(kCanvas, {
    assets: {
      catalog: game.catalog,
      loaders
    },
    worldLogger: playLoggerOptions(warn)
  });
  runtime.manager.setURLModifier(game.resolveURL);
  await setup(runtime.world);
  const scenes = await GameScenes.load(
    runtime.world.assetCoordinator,
    game.start
  );

  await runtime.load({
    scene: scenes.scene(
      game.start,
      game.catalog.get(game.start).path.name,
      components
    )
  });
}

window.addEventListener("error", (event) => report(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => report(event.reason));
play().catch(report);
