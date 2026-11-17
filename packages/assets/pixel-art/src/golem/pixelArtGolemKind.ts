// Import Third-party Dependencies
import { golemKind } from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import { pixelArtEditableKind } from "../network/server.ts";
import { PixelArtAsset } from "./PixelArtAsset.ts";
import { pixelIntents } from "./pixelIntents.ts";

// CONSTANTS
const kGuide = new URL("./guide.md", import.meta.url);

export const PIXEL_ART_GOLEM_KIND = golemKind(
  pixelArtEditableKind(),
  PixelArtAsset,
  {
    guide: kGuide,
    intents: pixelIntents()
  }
);
