// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/e2e";
import {
  e2eFolder,
  editorFixture,
  type EditorTarget,
  type OpenEditorOptions
} from "@jolly-pixel/e2e/editor";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import {
  encodePixelArtDocument,
  PixelBuffer,
  PixelDocumentState,
  serializePixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { TEXTURE_SIZE } from "./support/canvas.ts";
import { PixelArtPanel } from "./support/panel.ts";
import type { PixelArtEditor } from "../../page/scripts/PixelArtEditor.ts";
import type { TextureImportPolicy } from "../../src/index.ts";

export { expect } from "@playwright/test";

// CONSTANTS
const kRuntimeMaxFps = 1;
const kTransparent = {
  r: 0,
  g: 0,
  b: 0,
  a: 0
};

export interface PlaygroundOptions {
  runtime?: boolean;
  maxFps?: number;
  importPolicy?: TextureImportPolicy;
  addDelay?: number;
}

export function playground(
  options: PlaygroundOptions = {}
): OpenEditorOptions {
  const {
    runtime = false,
    maxFps = kRuntimeMaxFps,
    importPolicy = "replace",
    addDelay = 0
  } = options;

  const query: Record<string, string> = {
    empty: "true",
    "import-policy": importPolicy
  };
  if (!runtime) {
    query.runtime = "off";
  }
  if (addDelay > 0) {
    query["add-delay"] = String(addDelay);
  }

  return {
    maxFps: runtime ? maxFps : undefined,
    query
  };
}

export const test = editorFixture<EditorTarget>({
  editor: playground(),
  async create(catalog) {
    const blank = new PixelBuffer({
      size: TEXTURE_SIZE,
      defaultColor: kTransparent
    });
    const id = await catalog.create(
      `${e2eFolder()}/canvas.pixelart`,
      encodePixelArtDocument(
        serializePixelDocument(new PixelDocumentState({ buffer: blank }))
      ),
      { kind: PIXEL_ART_KIND }
    );

    return { id };
  }
}).extend<{
  panel: PixelArtPanel;
  peerPanel: PixelArtPanel;
  commands: CommandConsole;
}>({
  panel: async({ page }, use) => {
    await use(new PixelArtPanel(page));
  },
  peerPanel: async({ peer }, use) => {
    await use(new PixelArtPanel(peer));
  },
  commands: async({ page }, use) => {
    await use(new CommandConsole(page));
  }
});

declare global {
  interface Window {
    pixelArtEditor?: PixelArtEditor;
  }
}
