// Import Third-party Dependencies
import { bootStandalone } from "@jolly-pixel/editor.host";
import "@jolly-pixel/ui/elements/dock";
import "@jolly-pixel/ui/elements/dock-layout";
import "@jolly-pixel/ui/elements/pane";
import "@jolly-pixel/ui/elements/presence-stack";
import "@jolly-pixel/ui/elements/scope";

// Import Internal Dependencies
import "./icons.ts";
import "./panes/code/ScriptCode.ts";
import "./panes/outline/ScriptOutlinePane.ts";
import { ScriptEditor } from "./ScriptEditor.ts";

declare global {
  interface Window {
    scriptEditor?: ScriptEditor;
  }
}

void bootStandalone(ScriptEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "scriptEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const [
      { createScriptProject },
      { default: createHandlers }
    ] = await Promise.all([
      import("./seed/scriptProject.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      ...createScriptProject(),
      handlers: createHandlers()
    };
  }
});
