// Import Third-party Dependencies
import { bootStandalone } from "@jolly-pixel/editor.host";
import "@jolly-pixel/ui/elements/dock";
import "@jolly-pixel/ui/elements/dock-layout";
import "@jolly-pixel/ui/elements/pane";
import "@jolly-pixel/ui/elements/presence-stack";
import "@jolly-pixel/ui/elements/scope";

// Import Internal Dependencies
import "./icons.ts";
import "./panes/track/SoundTrack.ts";
import "./panes/track/SoundWave.ts";
import "./panes/sound/SoundFileFolder.ts";
import "./panes/sound/SoundDetails.ts";
import { SoundEditor } from "./SoundEditor.ts";

declare global {
  interface Window {
    soundEditor?: SoundEditor;
  }
}

void bootStandalone(SoundEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "soundEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const [
      { createSoundProject },
      { default: createHandlers }
    ] = await Promise.all([
      import("./seed/soundProject.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      ...createSoundProject(),
      handlers: createHandlers()
    };
  }
});
