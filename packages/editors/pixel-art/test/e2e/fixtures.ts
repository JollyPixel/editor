// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  PORTS,
  socketUrl
} from "@jolly-pixel/e2e";
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
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { TEXTURE_SIZE } from "../../examples/scripts/config.ts";
import type { PixelArtDemo } from "../../examples/scripts/boot/PixelArtDemo.ts";
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

export interface DemoOptions {
  runtime?: boolean;
  maxFps?: number;
  importPolicy?: TextureImportPolicy;
  addDelay?: number;
}

export function demo(
  options: DemoOptions = {}
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
    username: "E2E",
    maxFps: runtime ? maxFps : undefined,
    query
  };
}

export function demoPanel(
  page: Page
): Locator {
  return page.locator("pixel-draw-panel");
}

export const test = editorFixture<EditorTarget>({
  socketUrl: socketUrl(PORTS.pixelArt),
  editor: demo(),
  async create(catalog) {
    const blank = new PixelBuffer({
      size: TEXTURE_SIZE,
      defaultColor: kTransparent
    });
    const id = await catalog.create(
      `${e2eFolder()}/canvas.pixelart`,
      encodePixelArtDocument(serializePixelBuffer(blank)),
      { kind: PIXEL_ART_KIND }
    );

    return { id };
  }
}).extend<{
  panel: Locator;
}>({
  panel: async({ page }, use) => {
    await use(demoPanel(page));
  }
});

declare global {
  interface Window {
    pixelArtDemo?: PixelArtDemo;
  }
}
