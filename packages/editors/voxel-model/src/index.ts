// Import Third-party Dependencies
import { bootStandalone } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import "./app/paneIcons.ts";
import "./app/LeftPanel.ts";
import "./app/RightPanel.ts";
import { VoxelModelEditor } from "./boot/VoxelModelEditor.ts";

declare global {
  interface Window {
    voxelModelEditor?: VoxelModelEditor;
  }
}

void bootStandalone(VoxelModelEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "voxelModelEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const { createModelProject } = await import("./boot/modelProject.ts");

    return createModelProject(crypto.randomUUID());
  }
});
