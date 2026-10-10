// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import type { PixelDrawPanel } from "../../../src/index.ts";

export type BrushSlot = "primary" | "secondary";

export interface BrushColors {
  primary: string;
  secondary: string;
}

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export class ColorPicker {
  readonly root: Locator;
  readonly hex: Locator;
  readonly area: Locator;

  constructor(
    root: Locator
  ) {
    this.root = root;
    this.hex = root.locator("input.hex");
    this.area = root.getByRole("group", { name: "Saturation and value" });
  }

  async commit(
    hex: string
  ): Promise<void> {
    await this.hex.fill(hex);
    await this.hex.press("Enter");
  }
}

export class ColorControls {
  readonly dockToggle: Locator;
  readonly dock: Locator;
  readonly dockedPicker: ColorPicker;
  readonly foreground: Locator;
  readonly background: Locator;
  readonly backgroundSwatch: Locator;
  readonly swap: Locator;
  readonly grid: Locator;
  readonly gridSlots: Locator;
  readonly popover: Locator;
  readonly popoverDialog: Locator;
  readonly popoverPicker: ColorPicker;
  readonly #panel: Locator;

  constructor(
    panel: Locator
  ) {
    this.#panel = panel;
    this.dockToggle = panel.getByRole("button", { name: "Docked color picker" });
    this.dock = panel.locator("color-dock");
    this.dockedPicker = new ColorPicker(
      panel.locator("color-dock > jolly-color-picker")
    );
    this.foreground = panel.locator("color-swatch.fg button");
    this.backgroundSwatch = panel.locator("color-swatch.bg");
    this.background = this.backgroundSwatch.locator("button");
    this.swap = panel.getByRole("button", {
      name: "Swap foreground and background colors"
    });
    this.grid = panel.locator("color-palette-grid");
    this.gridSlots = this.grid.locator(".grid button");
    this.popover = panel.locator("color-picker-popover");
    this.popoverDialog = this.popover.getByRole("dialog");
    this.popoverPicker = new ColorPicker(
      this.popover.locator("jolly-color-picker")
    );
  }

  slot(
    index: number
  ): Locator {
    return this.grid.getByRole("button", {
      name: `Palette color ${index}`,
      exact: true
    });
  }

  async toggleDock(): Promise<void> {
    await this.dockToggle.click();
    await this.dock.evaluate(async(element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
  }

  async assign(
    slot: BrushSlot,
    hex: string
  ): Promise<void> {
    await this.#panel.evaluate((element: PixelDrawPanel, args) => {
      element.canvasManager!.brush[args.slot].set(args.hex, 1);
    }, { slot, hex });
  }

  brush(): Promise<BrushColors> {
    return this.#panel.evaluate((element: PixelDrawPanel) => {
      const { brush } = element.canvasManager!;

      return {
        primary: brush.primary.asString("hex").toLowerCase(),
        secondary: brush.secondary.asString("hex").toLowerCase()
      };
    });
  }

  paletteColor(
    index: number
  ): Promise<PaletteColor> {
    return this.#panel.evaluate((element: PixelDrawPanel, slot) => (
      element.canvasManager!.document.palette.colorAt(slot)
    ), index);
  }
}
