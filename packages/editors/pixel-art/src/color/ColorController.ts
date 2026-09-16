// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import type {
  BrushColorSlot,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";
import {
  readBrushColor,
  writeBrushColor
} from "./brushColor.ts";

// CONSTANTS
const kDefaultForeground: ColorChangeDetail = {
  hex: "#000000",
  opacity: 1
};
const kDefaultBackground: ColorChangeDetail = {
  hex: "#ffffff",
  opacity: 1
};

export interface ColorPickedDetail extends ColorChangeDetail {
  slot?: BrushColorSlot;
}

export class ColorController {
  readonly #host: ReactiveControllerHost;
  readonly #canvas: () => PixelArtCanvas | null;
  #docked = false;
  #undockedBackground: ColorChangeDetail | null = null;

  constructor(
    host: ReactiveControllerHost,
    canvas: () => PixelArtCanvas | null
  ) {
    this.#host = host;
    this.#canvas = canvas;
  }

  get foreground(): ColorChangeDetail {
    const brush = this.#canvas()?.brush;

    return brush ? readBrushColor(brush.primary) : kDefaultForeground;
  }

  get background(): ColorChangeDetail {
    const brush = this.#canvas()?.brush;

    return brush ? readBrushColor(brush.secondary) : kDefaultBackground;
  }

  get docked(): boolean {
    return this.#docked;
  }

  set docked(
    value: boolean
  ) {
    if (value === this.#docked) {
      return;
    }

    this.#docked = value;
    if (value) {
      this.#dock();
    }
    else {
      const background = this.#undockedBackground ?? this.foreground;
      this.#undockedBackground = null;
      this.#write("secondary", background);
    }
    this.#host.requestUpdate();
  }

  adopt(): void {
    if (this.#docked) {
      this.#dock();
    }
  }

  changeForeground(
    color: ColorChangeDetail
  ): void {
    if (this.#docked) {
      this.changeActive(color);

      return;
    }

    this.#write("primary", color);
    this.#host.requestUpdate();
  }

  changeBackground(
    color: ColorChangeDetail
  ): void {
    if (this.#docked) {
      return;
    }

    this.#write("secondary", color);
    this.#host.requestUpdate();
  }

  changeActive(
    color: ColorChangeDetail
  ): void {
    this.#applyActive(color);
    this.#host.requestUpdate();
  }

  swap(): void {
    if (this.#docked) {
      return;
    }

    this.#canvas()?.brush.swapColors();
    this.#host.requestUpdate();
  }

  onColorPicked(
    detail: ColorPickedDetail
  ): void {
    if (this.#docked) {
      this.#applyActive({
        hex: detail.hex,
        opacity: detail.opacity
      });
    }
    this.#host.requestUpdate();
  }

  #dock(): void {
    this.#undockedBackground = this.background;
    this.#applyActive(this.foreground);
  }

  #applyActive(
    color: ColorChangeDetail
  ): void {
    this.#write("primary", color);
    this.#write("secondary", color);
  }

  #write(
    slot: BrushColorSlot,
    color: ColorChangeDetail
  ): void {
    const brush = this.#canvas()?.brush;
    if (brush) {
      writeBrushColor(brush[slot], color);
    }
  }
}
