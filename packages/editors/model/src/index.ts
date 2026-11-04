// Import Third-party Dependencies
import { bootStandalone } from "@jolly-pixel/editor.host";
import "@jolly-pixel/ui/elements/dock";
import "@jolly-pixel/ui/elements/dock-layout";
import "@jolly-pixel/ui/elements/pane";
import "@jolly-pixel/ui/elements/pane-group";
import "@jolly-pixel/ui/elements/scope";

// Import Internal Dependencies
import "./icons.ts";
import "./panes/ModelFileFolder.ts";
import "./panes/ModelAnimate.ts";
import "./panes/ModelDetails.ts";
import "./panes/ModelStatus.ts";
import { ModelEditor } from "./ModelEditor.ts";

declare global {
  interface Window {
    modelEditor?: ModelEditor;
  }
}

void bootStandalone(ModelEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "modelEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const [
      { createModelProject },
      { default: createHandlers }
    ] = await Promise.all([
      import("./seed/modelProject.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      ...createModelProject(),
      handlers: createHandlers()
    };
  }
});
