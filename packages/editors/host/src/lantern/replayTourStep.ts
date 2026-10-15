// Import Third-party Dependencies
import type { TourStepOptions } from "@jolly-pixel/lantern";

export const REPLAY_TOUR_STEP = {
  id: "replay",
  target: ["jolly-editor-toolbar", "[data-tour=tours]"],
  side: "below",
  title: "Replay",
  body: "You can replay this tour from here."
} as const satisfies TourStepOptions;
