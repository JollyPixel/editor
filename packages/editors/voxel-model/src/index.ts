// Import Third-party Dependencies
import { bootStandalone } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import "./app/paneIcons.ts";
import "./app/LeftPanel.ts";
import "./app/RightPanel.ts";
import "./features/material/MaterialLibrary.ts";
import "./features/history/HistoryBar.ts";
import "./features/animation/AnimatePanel.ts";
import "./features/animation/timeline/Timeline.ts";
import "./features/animation/timeline/TimelineTransport.ts";
import "./features/animation/AnimatingFrame.ts";
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
    const [{ createModelProject }, { default: createHandlers }] = await Promise.all([
      import("./boot/modelProject.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      ...createModelProject(crypto.randomUUID()),
      handlers: createHandlers()
    };
  }
});
