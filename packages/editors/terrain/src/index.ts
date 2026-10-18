// Import Third-party Dependencies
import "@jolly-pixel/ui";
import { bootStandalone } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import { TerrainEditor } from "./boot/TerrainEditor.ts";

declare global {
  interface Window {
    terrainEditor?: TerrainEditor;
  }
}

void bootStandalone(TerrainEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "terrainEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const [
      { createDefaultSeed },
      { default: createHandlers }
    ] = await Promise.all([
      import("./boot/defaultSeed.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      ...createDefaultSeed(),
      handlers: createHandlers()
    };
  }
});
