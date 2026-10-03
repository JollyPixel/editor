// Import Third-party Dependencies
import "@jolly-pixel/ui";
import { bootStandalone } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import "../../src/index.ts";
import { PixelArtEditor } from "./PixelArtEditor.ts";

declare global {
  interface Window {
    pixelArtEditor?: PixelArtEditor;
  }
}

void bootStandalone(PixelArtEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "pixelArtEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const [{ createPixelArtProject }, { default: createHandlers }] = await Promise.all([
      import("./pixelArtProject.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      ...createPixelArtProject(),
      handlers: createHandlers()
    };
  }
});
