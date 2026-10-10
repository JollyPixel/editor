// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { TexturePoint } from "./canvas.ts";
import type { PixelDrawPanel } from "../../../src/index.ts";

export interface ActiveTextureState {
  activeTextureId: string | null;
  textureIds: string[];
  size: TexturePoint;
  mode: Mode;
  camera: TexturePoint;
  canUndo: boolean;
}

export class TextureTabs {
  readonly strip: Locator;
  readonly tabs: Locator;
  readonly #panel: Locator;

  constructor(
    panel: Locator
  ) {
    this.#panel = panel;
    this.strip = panel.locator("jolly-tabs");
    this.tabs = panel.getByRole("tab");
  }

  closeButton(
    name: string
  ): Locator {
    return this.#panel.getByRole("button", { name: `Close ${name}` });
  }

  activeState(): Promise<ActiveTextureState> {
    return this.#panel.evaluate((element: PixelDrawPanel) => {
      const canvas = element.canvasManager!;

      return {
        activeTextureId: element.activeTextureId,
        textureIds: element.textures.map((texture) => texture.id),
        size: canvas.textureSize,
        mode: canvas.mode,
        camera: { ...canvas.viewport.camera },
        canUndo: canvas.canUndo()
      };
    });
  }
}

export class ImportDialog {
  readonly dialog: Locator;
  readonly addAsNew: Locator;
  readonly replaceCurrent: Locator;
  readonly cancel: Locator;

  constructor(
    page: Page
  ) {
    this.dialog = page.locator("import-texture-dialog").getByRole("dialog");
    this.addAsNew = page.getByRole("button", { name: "Add as new" });
    this.replaceCurrent = page.getByRole("button", { name: "Replace current" });
    this.cancel = page.getByRole("button", { name: "Cancel" });
  }
}
