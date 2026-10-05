// Import Internal Dependencies
import { clamp } from "../../utils/math.ts";
import { SVG_NS } from "../constants.ts";
import type {
  DefaultViewport
} from "../Viewport.ts";
import type {
  SelectionRect
} from "../../types.ts";
import type {
  UVTriangleCorner
} from "../../uv/region/UVRegion.ts";

// CONSTANTS
const kFontSize = 10;
const kGap = 14;
const kMargin = 4;
const kInsetStart = 3;
const kInsetEnd = 6;
const kCharWidth = 6.2;
const kBottomRight: SizeLabelCorner = {
  right: true,
  bottom: true
};
const kTriangleCorners: Record<UVTriangleCorner, SizeLabelCorner> = {
  "top-left": { right: false, bottom: false },
  "top-right": { right: true, bottom: false },
  "bottom-left": { right: false, bottom: true },
  "bottom-right": { right: true, bottom: true }
};

export interface SizeLabelPaint {
  fill: string;
  stroke: string;
}

export interface SizeLabelOptions extends SizeLabelPaint {
  overlay: string;
}

export interface SizeLabelPlacement {
  label: string;
  x: number;
  y: number;
  anchor: "start" | "end";
  bounds: SelectionRect;
}

interface SizeLabelCorner {
  right: boolean;
  bottom: boolean;
}

export class SizeLabel {
  #viewport: DefaultViewport;
  #text: SVGTextElement;

  constructor(
    viewport: DefaultViewport,
    options: SizeLabelOptions
  ) {
    this.#viewport = viewport;
    this.#text = SizeLabel.#createText(options.overlay);
    this.paint(options);
  }

  static #createText(
    overlay: string
  ): SVGTextElement {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("data-overlay", overlay);
    text.setAttribute("font-size", String(kFontSize));
    text.setAttribute("text-anchor", "end");
    text.setAttribute("paint-order", "stroke");
    text.setAttribute("stroke-width", "3");
    text.setAttribute("stroke-linejoin", "round");
    text.setAttribute("visibility", "hidden");
    Object.assign(text.style, {
      pointerEvents: "none"
    });

    return text;
  }

  paint(
    paint: SizeLabelPaint
  ): void {
    this.#text.setAttribute("fill", paint.fill);
    this.#text.setAttribute("stroke", paint.stroke);
  }

  appendTo(
    parent: SVGElement
  ): void {
    parent.appendChild(this.#text);
  }

  outside(
    rect: SelectionRect
  ): SizeLabelPlacement | null {
    const canvasWidth = this.#viewport.canvasWidth;
    const canvasHeight = this.#viewport.canvasHeight;
    const screen = this.#viewport.toScreenRect(rect);
    const left = screen.x;
    const top = screen.y;
    const right = left + screen.width;
    const bottom = top + screen.height;

    const offscreen = right < 0 ||
      bottom < 0 ||
      left > canvasWidth ||
      top > canvasHeight;
    if (offscreen) {
      return null;
    }

    const label = SizeLabel.#labelOf(rect);
    const width = SizeLabel.#widthOf(label);
    const below = bottom + kGap;
    const y = below > canvasHeight - kMargin ? top - kGap + kFontSize : below;

    return SizeLabel.#placement(
      label,
      clamp(right, kMargin + width, canvasWidth - kMargin),
      clamp(y, kMargin + kFontSize, canvasHeight - kMargin),
      "end"
    );
  }

  inside(
    rect: SelectionRect
  ): SizeLabelPlacement | null {
    const screen = this.#viewport.toScreenRect(rect);
    const placement = SizeLabel.#atCorner(rect, screen, kBottomRight, 0);
    const inset = kInsetStart + kInsetEnd;
    const fits = screen.width >= placement.bounds.width + inset &&
      screen.height >= kFontSize + inset;

    return fits ? placement : null;
  }

  insideTriangle(
    rect: SelectionRect,
    corner: UVTriangleCorner,
    skippedLines: number
  ): SizeLabelPlacement | null {
    const screen = this.#viewport.toScreenRect(rect);
    const anchor = kTriangleCorners[corner];
    const placement = SizeLabel.#atCorner(rect, screen, anchor, skippedLines);
    const { bounds } = placement;
    const reachX = anchor.right ?
      screen.x + screen.width - bounds.x :
      bounds.x + bounds.width - screen.x;
    const reachY = anchor.bottom ?
      screen.y + screen.height - bounds.y :
      bounds.y + bounds.height - screen.y;
    const fits = ((reachX + kInsetStart) / screen.width) +
      ((reachY + kInsetStart) / screen.height) <= 1;

    return fits ? placement : null;
  }

  show(
    placement: SizeLabelPlacement | null
  ): void {
    if (placement === null) {
      this.clear();

      return;
    }

    this.#text.textContent = placement.label;
    this.#text.setAttribute("x", String(placement.x));
    this.#text.setAttribute("y", String(placement.y));
    this.#text.setAttribute("text-anchor", placement.anchor);
    this.#text.setAttribute("visibility", "visible");
  }

  clear(): void {
    this.#text.setAttribute("visibility", "hidden");
  }

  remove(): void {
    this.#text.remove();
  }

  static #atCorner(
    rect: SelectionRect,
    screen: SelectionRect,
    corner: SizeLabelCorner,
    skippedLines: number
  ): SizeLabelPlacement {
    const shift = skippedLines * kFontSize;

    return SizeLabel.#placement(
      SizeLabel.#labelOf(rect),
      corner.right ?
        screen.x + screen.width - kInsetEnd :
        screen.x + kInsetStart,
      corner.bottom ?
        screen.y + screen.height - kInsetEnd - shift :
        screen.y + kInsetStart + kFontSize + shift,
      corner.right ? "end" : "start"
    );
  }

  static #placement(
    label: string,
    x: number,
    y: number,
    anchor: "start" | "end"
  ): SizeLabelPlacement {
    const width = SizeLabel.#widthOf(label);

    return {
      label,
      x,
      y,
      anchor,
      bounds: {
        x: anchor === "end" ? x - width : x,
        y: y - kFontSize,
        width,
        height: kFontSize
      }
    };
  }

  static #labelOf(
    rect: SelectionRect
  ): string {
    return `${rect.width}×${rect.height}`;
  }

  static #widthOf(
    label: string
  ): number {
    return label.length * kCharWidth;
  }
}
