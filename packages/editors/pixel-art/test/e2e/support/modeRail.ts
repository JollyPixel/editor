// Import Third-party Dependencies
import type { Locator } from "@playwright/test";
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelDrawPanel } from "../../../src/index.ts";

// CONSTANTS
const kModeLabel: Record<Mode, string> = {
  move: "Move",
  paint: "Paint",
  erase: "Erase",
  fill: "Fill",
  select: "Select",
  uv: "UV"
};

export class ModeRail {
  readonly root: Locator;
  readonly clipBadge: Locator;
  readonly brushSize: Locator;
  readonly #panel: Locator;

  constructor(
    panel: Locator
  ) {
    this.#panel = panel;
    this.root = panel.locator("mode-rail");
    this.clipBadge = this.root.locator("[part=uv-clip-badge]");
    this.brushSize = panel.locator(".tool-option-overlay input[type=range]");
  }

  button(
    mode: Mode
  ): Locator {
    return this.#panel.getByRole("button", {
      name: kModeLabel[mode],
      exact: true
    });
  }

  option(
    name: string
  ): Locator {
    return this.#panel.getByRole("button", {
      name,
      exact: true
    });
  }

  flyout(
    option: string
  ): Locator {
    return this.root.locator(".rail-flyout").filter({
      has: this.#panel.page().getByRole("button", {
        name: option,
        exact: true
      })
    });
  }

  async select(
    mode: Mode
  ): Promise<void> {
    await this.button(mode).click();
  }

  async pick(
    mode: Mode,
    option: string
  ): Promise<void> {
    await this.#panel.page().mouse.move(0, 0);
    await this.button(mode).hover();
    await this.option(option).click();
  }

  async resizeBrush(
    size: number
  ): Promise<void> {
    await this.brushSize.fill(String(size));
  }

  active(): Promise<Mode> {
    return this.#panel.evaluate(
      (element: PixelDrawPanel) => element.canvasManager!.mode
    );
  }
}
