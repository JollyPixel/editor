// Import Third-party Dependencies
import { bootStandalone } from "@jolly-pixel/editor.host";
import "@jolly-pixel/ui/elements/dock";
import "@jolly-pixel/ui/elements/dock-layout";
import "@jolly-pixel/ui/elements/pane";
import "@jolly-pixel/ui/elements/scope";

// Import Internal Dependencies
import "./icons.ts";
import "./panes/TextureFileFolder.ts";
import "./panes/TextureDetails.ts";
import "./panes/TextureStage.ts";
import { TextureEditor } from "./TextureEditor.ts";

declare global {
  interface Window {
    textureEditor?: TextureEditor;
  }
}

void bootStandalone(TextureEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "textureEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const [
      { createTextureProject },
      { default: createHandlers }
    ] = await Promise.all([
      import("./seed/textureProject.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      ...createTextureProject(),
      handlers: createHandlers()
    };
  }
});
