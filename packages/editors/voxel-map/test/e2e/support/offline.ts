// Import Third-party Dependencies
import type { OpenEditorOptions } from "@jolly-pixel/e2e/editor";

export const OFFLINE_EDITOR: OpenEditorOptions = {
  maxFps: 10,
  query: {
    offline: "",
    samples: "0"
  }
};
