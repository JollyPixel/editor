// Import Third-party Dependencies
import "@jolly-pixel/ui";
import { bootStandalone } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import { VoxelMapEditor } from "./boot/VoxelMapEditor.ts";
import "./app/icons.ts";

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
    const [{ loadWorldProject }, { default: createHandlers }] = await Promise.all([
      import("./boot/worldProject.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      ...await loadWorldProject(),
      handlers: createHandlers()
    };
  }
});
