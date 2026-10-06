// Import Third-party Dependencies
import "@jolly-pixel/ui";
import "@jolly-pixel/editor.pixel-art";
import { bootStandalone } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import { VoxelMapEditor } from "./boot/VoxelMapEditor.ts";

declare global {
  interface Window {
    voxelMapEditor?: VoxelMapEditor;
  }
}

void bootStandalone(VoxelMapEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "voxelMapEditor",
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
