// Import Internal Dependencies
import { getColorAsRGBA } from "./utils";

export interface BrushManagerOptions {
  color?: string;
  size?: number;
  maxSize?: number;
  colorPickerHtmlElement?: HTMLInputElement;
  highlight?: {
    colorInline?: string;
    colorOutline?: string;
  };
}

export default class BrushManager {
  private color!: string;

  private size!: number;
  private maxSize: number;

  private colorInline!: string;
  private colorOutline!: string;

  private colorPickerHtmlElement: HTMLInputElement | undefined;

  constructor(options: BrushManagerOptions = {}) {
    this.setColor(options.color || "red");
    this.setSize(options.size || 32);
    this.maxSize = options.maxSize || 32;
    this.colorPickerHtmlElement = options.colorPickerHtmlElement;

    this.setColorInline(options.highlight?.colorInline || "#FFF");
    this.setColorOutline(options.highlight?.colorOutline || "#000");
  }

  setColor(color: string) {
    const [r, g, b, a] = getColorAsRGBA(color);
    this.color = `rgba(${r}, ${g}, ${b}, ${a / 255})`;

    if (a === 255 && this.colorPickerHtmlElement !== undefined) {
      this.colorPickerHtmlElement.value = `rgb(${r}, ${g}, ${b})`;
    }
  }

  getColor(): string {
    return this.color;
  }

  setColorInline(color: string) {
    const [r, g, b] = getColorAsRGBA(color);
    this.colorInline = `rgb(${r}, ${g}, ${b})`;
  }

  getColorInline() {
    return this.colorInline;
  }

  setColorOutline(color: string) {
    const [r, g, b] = getColorAsRGBA(color);
    this.colorOutline = `rgb(${r}, ${g}, ${b})`;
  }

  getColorOutline() {
    return this.colorOutline;
  }

  setSize(size: number) {
    if (size < 1) {
      this.size = 1;

      return;
    }
    if (size > this.maxSize) {
      this.size = this.maxSize;

      return;
    }

    this.size = size;
  }

  getSize(): number {
    return this.size;
  }

  getAffectedPixels(x: number, y: number): { x: number; y: number; }[] {
    const pixels: { x: number; y: number; }[] = [];

    const half = Math.floor(this.size / 2);
    if (this.size % 2 === 0) {
      for (let dx = -half; dx < half; dx++) {
        for (let dy = -half; dy < half; dy++) {
          pixels.push({ x: x + dx, y: y + dy });
        }
      }

      return pixels;
    }

    for (let dx = -half; dx <= half; dx++) {
      for (let dy = -half; dy <= half; dy++) {
        pixels.push({ x: x + dx, y: y + dy });
      }
    }

    return pixels;
  }
}

// export { BrushManager };
