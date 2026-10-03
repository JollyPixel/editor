// Import Third-party Dependencies
import "@jolly-pixel/ui";
import {
  bootStandalone,
  PageAppearance
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import "../../src/index.ts";
import { PixelArtEditor } from "./PixelArtEditor.ts";
import { PixelArtFeatures } from "./PixelArtFeatures.ts";

declare global {
  interface Window {
    pixelArtEditor?: PixelArtEditor;
  }
}

const features = import.meta.env.DEV ?
  PixelArtFeatures.playground.withQuery() :
  PixelArtFeatures.editor;
if (features.appearance !== null) {
  new PageAppearance().apply(features.appearance);
}

const editor = PixelArtEditor.definition({
  features,
  loadPreview: import.meta.env.DEV && features.preview ?
    async() => (await import("./preview/PreviewPane.ts")).PreviewPane :
    null
});

void bootStandalone(editor, {
  dev: import.meta.env.DEV,
  debugHandle: "pixelArtEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const [{ createPixelArtSeed }, { default: createHandlers }] = await Promise.all([
      import("./pixelArtProject.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return {
      seed: createPixelArtSeed(),
      handlers: createHandlers()
    };
  }
});
