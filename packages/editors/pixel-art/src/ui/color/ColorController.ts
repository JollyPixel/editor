// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import type {
  BrushColorSlot,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";

export interface ColorPickedDetail extends ColorChangeDetail {
  slot?: BrushColorSlot;
}

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
  #docked = false;
  #undockedBackground: ColorChangeDetail | null = null;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    host.addController(this);
  }

  hostDisconnected(): void {
    // Do nothing
  }

  get foreground(): ColorChangeDetail {
    return this.#foreground;
  }

  get background(): ColorChangeDetail {
    return this.#background;
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
      this.#readBrush();
      this.#undockedBackground = this.#background;
      this.#applyActive(this.#foreground);
    }
    else {
      this.#background = this.#undockedBackground ?? this.#foreground;
      this.#undockedBackground = null;
      this.#canvas?.brush.secondary.set(
        this.#background.hex,
        this.#background.opacity
      );
    }
    this.#host.requestUpdate();
  }

  attach(
    canvas: PixelArtCanvas
  ): void {
    if (this.#canvas === canvas) {
      return;
    }

    this.#canvas = canvas;
    this.#readBrush();

    if (this.#docked) {
      this.#undockedBackground = this.#background;
      this.#applyActive(this.#foreground);
    }
  }

  onForegroundChange(
    event: CustomEvent<ColorChangeDetail>
  ): void {
    if (this.#docked) {
      this.onActiveChange(event);

      return;
    }

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
    if (this.#docked) {
      return;
    }

    this.#background = event.detail;
    this.#canvas?.brush.secondary.set(
      event.detail.hex,
      event.detail.opacity
    );
    this.#host.requestUpdate();
  }

  onActiveChange(
    event: CustomEvent<ColorChangeDetail>
  ): void {
    this.#applyActive(event.detail);
    this.#host.requestUpdate();
  }

  swap(): void {
    if (this.#docked) {
      return;
    }

    [this.#foreground, this.#background] = [
      this.#background,
      this.#foreground
    ];
    this.#canvas?.brush.swapColors();
    this.#host.requestUpdate();
  }

  onColorPicked(
    detail: ColorPickedDetail
  ): void {
    const color = {
      hex: detail.hex,
      opacity: detail.opacity
    };

    if (this.#docked) {
      this.#applyActive(color);
    }
    else if (detail.slot === "secondary") {
      this.#background = color;
    }
    else {
      this.#foreground = color;
    }
    this.#host.requestUpdate();
  }

  #readBrush(): void {
    if (this.#canvas === null) {
      return;
    }

    const { primary, secondary } = this.#canvas.brush;
    this.#foreground = {
      hex: primary.asString("hex"),
      opacity: primary.opacity
    };
    this.#background = {
      hex: secondary.asString("hex"),
      opacity: secondary.opacity
    };
  }

  #applyActive(
    color: ColorChangeDetail
  ): void {
    this.#foreground = color;
    this.#background = color;
    this.#canvas?.brush.primary.set(color.hex, color.opacity);
    this.#canvas?.brush.secondary.set(color.hex, color.opacity);
  }
}
