// Import Third-party Dependencies
import type {
  AnchorRect,
  ViewportSize
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { CornerRadii } from "./CornerRadii.ts";

export interface HoleOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  radii: CornerRadii;
}

export class Hole {
  static around(
    rect: AnchorRect,
    radii: CornerRadii,
    viewport: ViewportSize,
    padding: number
  ): Hole {
    if (Hole.#reachesEdge(rect, viewport, padding)) {
      return new Hole({
        x: rect.left,
        y: rect.top,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
        radii
      });
    }

    return new Hole({
      x: rect.left - padding,
      y: rect.top - padding,
      width: rect.right - rect.left + (padding * 2),
      height: rect.bottom - rect.top + (padding * 2),
      radii: radii.grow(padding)
    });
  }

  static atCentre(
    viewport: ViewportSize
  ): Hole {
    return new Hole({
      x: viewport.width / 2,
      y: viewport.height / 2,
      width: 0,
      height: 0,
      radii: CornerRadii.SQUARE
    });
  }

  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radii: CornerRadii;

  constructor(
    options: HoleOptions
  ) {
    this.x = options.x;
    this.y = options.y;
    this.width = options.width;
    this.height = options.height;
    this.radii = options.radii;
  }

  equals(
    other: Hole
  ): boolean {
    return other.x === this.x &&
      other.y === this.y &&
      other.width === this.width &&
      other.height === this.height &&
      other.radii.equals(this.radii);
  }

  clipPath(
    viewport: ViewportSize
  ): string {
    const { x, y, width, height } = this;
    const {
      topLeft: tl,
      topRight: tr,
      bottomRight: br,
      bottomLeft: bl
    } = this.radii.clamp(Math.min(width, height) / 2);
    const outer = `M0 0H${viewport.width}V${viewport.height}H0Z`;
    const inner = [
      `M${x + tl} ${y}`,
      `H${x + width - tr}`,
      `A${tr} ${tr} 0 0 1 ${x + width} ${y + tr}`,
      `V${y + height - br}`,
      `A${br} ${br} 0 0 1 ${x + width - br} ${y + height}`,
      `H${x + bl}`,
      `A${bl} ${bl} 0 0 1 ${x} ${y + height - bl}`,
      `V${y + tl}`,
      `A${tl} ${tl} 0 0 1 ${x + tl} ${y}`,
      "Z"
    ].join("");

    return `path(evenodd, "${outer}${inner}")`;
  }

  toAnchorRect(): AnchorRect {
    return {
      top: this.y,
      left: this.x,
      bottom: this.y + this.height,
      right: this.x + this.width
    };
  }

  static #reachesEdge(
    rect: AnchorRect,
    viewport: ViewportSize,
    padding: number
  ): boolean {
    return rect.left < padding ||
      rect.top < padding ||
      rect.right > viewport.width - padding ||
      rect.bottom > viewport.height - padding;
  }
}
