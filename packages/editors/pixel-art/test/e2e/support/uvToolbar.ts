// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import type { PixelDrawPanel } from "../../../src/index.ts";

export type RegionState = "Stacked" | "Unfolded" | "Free";

export interface RegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class UvToolbar {
  readonly root: Locator;
  readonly createCube: Locator;
  readonly createRamp: Locator;
  readonly stateMenu: Locator;
  readonly rotateClockwise: Locator;
  readonly #panel: Locator;

  constructor(
    panel: Locator
  ) {
    this.#panel = panel;
    this.root = panel.locator("[part=uv-toolbar]");
    this.createCube = panel.getByRole("button", {
      name: "Create cube",
      exact: true
    });
    this.createRamp = panel.getByRole("button", {
      name: "Create ramp",
      exact: true
    });
    this.stateMenu = panel.getByRole("button", { name: /^Region state: / });
    this.rotateClockwise = panel.getByRole("button", {
      name: /^Rotate .* clockwise$/
    });
  }

  async changeState(
    state: RegionState
  ): Promise<void> {
    await this.stateMenu.click();
    await this.#panel.getByRole("menuitem", { name: state }).click();
  }

  addRegion(
    rect: RegionRect
  ): Promise<void> {
    return this.#panel.evaluate((element: PixelDrawPanel, regionRect) => {
      element.canvasManager!.uv.restore({
        id: "e2e-region",
        color: "#00ffff",
        state: "stacked",
        rect: regionRect
      });
    }, rect);
  }
}
