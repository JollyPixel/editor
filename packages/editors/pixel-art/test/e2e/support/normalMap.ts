// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import type { PixelDrawPanel } from "../../../src/index.ts";

export class NormalMapDock {
  readonly root: Locator;
  readonly toggle: Locator;
  readonly enableBox: Locator;
  readonly views: Locator;
  readonly normalView: Locator;
  readonly albedoView: Locator;
  readonly exportMenu: Locator;
  readonly override: Locator;
  readonly #panel: Locator;

  constructor(
    panel: Locator
  ) {
    this.#panel = panel;
    this.root = panel.locator("normal-map-dock");
    this.toggle = panel.getByRole("button", { name: "Normal map settings" });
    this.enableBox = this.root.locator("[part=normal-map-enable] input");
    this.views = panel.getByRole("radiogroup", { name: "Texture view" });
    this.normalView = panel.getByRole("radio", {
      name: "Normal",
      exact: true
    });
    this.albedoView = panel.getByRole("radio", {
      name: "Albedo",
      exact: true
    });
    this.exportMenu = panel.getByRole("button", { name: "Export textures" });
    this.override = panel.getByRole("button", { name: "Override normal map" });
  }

  exportItem(
    name: string
  ): Locator {
    return this.#panel.getByRole("menuitem", { name });
  }

  async enable(): Promise<void> {
    await this.toggle.click();
    await this.enableBox.check();
  }

  state() {
    return this.#panel.evaluate((element: PixelDrawPanel) => {
      const canvas = element.canvasManager!;

      return {
        view: canvas.textureView,
        mode: canvas.mode,
        config: canvas.document.normalMap?.toJSON() ?? null
      };
    });
  }
}
