// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";

/**
 * Foreground/background color state synced with PixelArtCanvas.brush.
 * Eyedropper picks are handled via `onColorPicked()`.
 */
export class ColorController implements ReactiveController {
  #host: ReactiveControllerHost;
  #canvas: PixelArtCanvas | null = null;

  #foreground: ColorChangeDetail = {
    hex: "#000000",
    opacity: 1
  };
  #background: ColorChangeDetail = {
    hex: "#ffffff",
    opacity: 1
  };

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    host.addController(this);
  }

  hostDisconnected(): void {
    this.#canvas = null;
  }

  get foreground(): ColorChangeDetail {
    return this.#foreground;
  }

  get background(): ColorChangeDetail {
    return this.#background;
  }

  attach(
    canvas: PixelArtCanvas
  ): void {
    this.#canvas = canvas;
    this.#foreground = {
      hex: canvas.brush.primary.asString("hex"),
      opacity: canvas.brush.primary.opacity
    };
    this.#background = {
      hex: canvas.brush.secondary.asString("hex"),
      opacity: canvas.brush.secondary.opacity
    };
  }

  onForegroundChange(
    event: CustomEvent<ColorChangeDetail>
  ): void {
    this.#foreground = event.detail;
    this.#canvas?.brush.primary.set(
      event.detail.hex,
      event.detail.opacity
    );
    this.#host.requestUpdate();
  }

  onBackgroundChange(
    event: CustomEvent<ColorChangeDetail>
  ): void {
    this.#background = event.detail;
    this.#canvas?.brush.secondary.set(
      event.detail.hex,
      event.detail.opacity
    );
    this.#host.requestUpdate();
  }

  swap(): void {
    [this.#foreground, this.#background] = [
      this.#background,
      this.#foreground
    ];
    this.#canvas?.brush.swapColors();
    this.#host.requestUpdate();
  }

  onColorPicked(
    detail: ColorChangeDetail
  ): void {
    this.#foreground = detail;
    this.#host.requestUpdate();
  }
}
