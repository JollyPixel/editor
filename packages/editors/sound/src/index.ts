// Import Third-party Dependencies
import { bootStandalone } from "@jolly-pixel/editor.host";
import "@jolly-pixel/ui/elements/scope";

// Import Internal Dependencies
import "./track/SoundTrack.ts";
import { SoundEditor } from "./boot/SoundEditor.ts";

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
      import("./boot/soundProject.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      ...createSoundProject(),
      handlers: createHandlers()
    };
  }
});
