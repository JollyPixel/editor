// Import Third-party Dependencies
import { bootStandalone } from "@jolly-pixel/editor.host";
import "@jolly-pixel/ui/elements/dock";
import "@jolly-pixel/ui/elements/dock-layout";
import "@jolly-pixel/ui/elements/pane";
import "@jolly-pixel/ui/elements/pane-group";
import "@jolly-pixel/ui/elements/scope";

// Import Internal Dependencies
import "./icons.ts";
import "./panes/EnvironmentPanel.ts";
import { EnvironmentEditor } from "./EnvironmentEditor.ts";

declare global {
  interface Window {
    environmentEditor?: EnvironmentEditor;
  }
}

void bootStandalone(EnvironmentEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "environmentEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const [
      { createEnvironmentProject },
      { default: createHandlers }
    ] = await Promise.all([
      import("./seed/environmentProject.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      ...createEnvironmentProject(),
      handlers: createHandlers()
    };
  }
});
