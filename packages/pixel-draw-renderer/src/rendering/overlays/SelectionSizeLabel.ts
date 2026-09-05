// Import Internal Dependencies
import { clamp } from "../../utils/math.ts";
import { SVG_NS } from "../constants.ts";
import type {
  DefaultViewport
} from "../Viewport.ts";
import type {
  BrushHighlight,
  SelectionRect
} from "../../types.ts";

// CONSTANTS
const kFontSize = 10;
const kGap = 14;
const kMargin = 4;
const kMinSize = 2;
const kCharWidth = 6.2;

/**
 * Local-only "16×16" readout anchored below the bottom-right corner of the selection.
 */
export class SelectionSizeLabel {
  #viewport: DefaultViewport;
  #text: SVGTextElement;

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    brush: BrushHighlight
  ) {
    this.#viewport = viewport;
    this.#text = SelectionSizeLabel.#createText(brush);
    svg.appendChild(this.#text);
  }

  static #createText(
    brush: BrushHighlight
  ): SVGTextElement {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("data-overlay", "selection-size");
    text.setAttribute("font-size", String(kFontSize));
    text.setAttribute("text-anchor", "end");
    text.setAttribute("fill", brush.colorOutline);
    text.setAttribute("paint-order", "stroke");
    text.setAttribute("stroke", brush.colorInline);
    text.setAttribute("stroke-width", "3");
    text.setAttribute("stroke-linejoin", "round");
    text.setAttribute("visibility", "hidden");
    Object.assign(text.style, {
      pointerEvents: "none"
    });

    return text;
  }

  draw(
    rect: SelectionRect
  ): void {
    if (rect.width < kMinSize || rect.height < kMinSize) {
      this.clear();

      return;
    }

    const zoom = this.#viewport.zoom.value;
    const camera = this.#viewport.camera;
    const canvasWidth = this.#viewport.canvasWidth;
    const canvasHeight = this.#viewport.canvasHeight;
    const left = rect.x * zoom + camera.x;
    const top = rect.y * zoom + camera.y;
    const right = left + rect.width * zoom;
    const bottom = top + rect.height * zoom;

    const offscreen = right < 0 ||
      bottom < 0 ||
      left > canvasWidth ||
      top > canvasHeight;
    if (offscreen) {
      this.clear();

      return;
    }

    const label = `${rect.width}×${rect.height}`;
    const width = label.length * kCharWidth;
    const below = bottom + kGap;
    // Flip above the box rather than let the label fall out of view.
    const y = below > canvasHeight - kMargin ? top - kGap + kFontSize : below;

    this.#text.textContent = label;
    this.#text.setAttribute(
      "x",
      String(clamp(right, kMargin + width, canvasWidth - kMargin))
    );
    this.#text.setAttribute(
      "y",
      String(clamp(y, kMargin + kFontSize, canvasHeight - kMargin))
    );
    this.#text.setAttribute("visibility", "visible");
  }

  clear(): void {
    this.#text.setAttribute("visibility", "hidden");
  }
}
