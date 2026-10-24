// Import Third-party Dependencies
import "@jolly-pixel/editor.pixel-art";
import { bootStandalone } from "@jolly-pixel/editor.host";
import "@jolly-pixel/ui/elements/dock";
import "@jolly-pixel/ui/elements/dock-layout";
import "@jolly-pixel/ui/elements/log";
import "@jolly-pixel/ui/elements/pane";
import "@jolly-pixel/ui/elements/pane-group";
import "@jolly-pixel/ui/elements/presence-stack";
import "@jolly-pixel/ui/elements/scope";

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
