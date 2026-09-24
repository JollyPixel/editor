// Import Third-party Dependencies
import "@jolly-pixel/ui";
import { bootStandalone } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import { VoxelMapEditor } from "./boot/VoxelMapEditor.ts";
import "./app/sidebarIcons.ts";

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
    const { loadWorldProject } = await import("./boot/worldProject.ts");

    return loadWorldProject();
  }
});
