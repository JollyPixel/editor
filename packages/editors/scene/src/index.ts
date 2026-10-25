// Import Third-party Dependencies
import { bootStandalone } from "@jolly-pixel/editor.host";
import "@jolly-pixel/ui/elements/dock";
import "@jolly-pixel/ui/elements/dock-layout";
import "@jolly-pixel/ui/elements/log";
import "@jolly-pixel/ui/elements/pane";
import "@jolly-pixel/ui/elements/pane-group";
import "@jolly-pixel/ui/elements/presence-stack";
import "@jolly-pixel/ui/elements/scope";

// Import Internal Dependencies
import "./app/sceneIcons.ts";
import "./features/hierarchy/HierarchyPanel.ts";
import "./features/inspector/InspectorPanel.ts";
import "./features/environment/ScenePanel.ts";
import "./features/viewport/ViewToolbar.ts";
import { SceneEditor } from "./boot/SceneEditor.ts";

declare global {
  interface Window {
    sceneEditor?: SceneEditor;
  }
}

void bootStandalone(SceneEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "sceneEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const [
      { createSceneProject },
      { default: createHandlers }
    ] = await Promise.all([
      import("./boot/sceneProject.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      ...createSceneProject(),
      handlers: createHandlers()
    };
  }
});
