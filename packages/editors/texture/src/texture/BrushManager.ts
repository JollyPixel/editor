// Import Internal Dependencies
import { getColorAsRGBA } from "../utils.js";

export interface BrushManagerOptions {
  color?: string;
  size?: number;
  maxSize?: number;
  highlight?: {
    colorInline?: string;
    colorOutline?: string;
  };
}

export default class BrushManager {
  private color!: string;
  private opacity: number;

  private size!: number;
  private maxSize: number;

  private colorInline!: string;
  private colorOutline!: string;

  constructor(options: BrushManagerOptions = {}) {
    this.setColor(options.color || "red");
    this.maxSize = Math.max(options.maxSize || 32, 1);
    this.setSize(options.size || this.maxSize);
    this.opacity = 1;

    this.setColorInline(options.highlight?.colorInline || "#FFF");
    this.setColorOutline(options.highlight?.colorOutline || "#000");
  }

  setColor(color: string) {
    const [r, g, b] = getColorAsRGBA(color);
    this.color = `rgba(${r}, ${g}, ${b}, ${this.opacity})`;
  }

  setColorWithOpacity(color: string, opacity: number) {
    const [r, g, b] = getColorAsRGBA(color);
    this.opacity = Math.max(0, Math.min(1, opacity));
    this.color = `rgba(${r}, ${g}, ${b}, ${this.opacity})`;
  }

  getColor(): string {
    return this.color;
  }

  setOpacity(opacity: number) {
    if (opacity < 0) {
      this.opacity = 0;

      return;
    }
    if (opacity > 1) {
      this.opacity = 1;

      return;
    }

    this.opacity = opacity;

    const [r, g, b] = getColorAsRGBA(this.color);
    this.color = `rgba(${r}, ${g}, ${b}, ${this.opacity})`;
  }

  getOpacity(): number {
    return this.opacity;
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
