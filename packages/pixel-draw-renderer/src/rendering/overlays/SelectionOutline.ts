// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import {
  selectionContourPath,
  traceSelectionContour
} from "./selectionContour.ts";
import type {
  DefaultViewport
} from "../Viewport.ts";
import type {
  BrushHighlight,
  SelectionRect
} from "../../types.ts";

/**
 * Renders rectangular and masked selection outlines.
 */
export class SelectionOutline {
  #viewport: DefaultViewport;
  #outline: SVGRectElement;
  #inline: SVGRectElement;
  #outlinePath: SVGPathElement;
  #inlinePath: SVGPathElement;

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    brush: BrushHighlight
  ) {
    this.#viewport = viewport;

    const [outline, inline] = this.#initRects(svg, brush);
    this.#outline = outline;
    this.#inline = inline;

    const [outlinePath, inlinePath] = this.#initPaths(svg, brush);
    this.#outlinePath = outlinePath;
    this.#inlinePath = inlinePath;
  }

  #initRects(
    svg: SVGElement,
    brush: BrushHighlight
  ): [outline: SVGRectElement, inline: SVGRectElement] {
    const outline = document.createElementNS(SVG_NS, "rect");
    SelectionOutline.#applyDashStyle(
      outline,
      brush.colorOutline,
      0
    );
    svg.appendChild(outline);

    const inline = document.createElementNS(SVG_NS, "rect");
    SelectionOutline.#applyDashStyle(
      inline,
      brush.colorInline,
      6
    );
    svg.appendChild(inline);

    return [outline, inline];
  }

  #initPaths(
    svg: SVGElement,
    brush: BrushHighlight
  ): [outline: SVGPathElement, inline: SVGPathElement] {
    const outline = document.createElementNS(SVG_NS, "path");
    SelectionOutline.#applyDashStyle(
      outline,
      brush.colorOutline,
      0
    );
    svg.appendChild(outline);

    const inline = document.createElementNS(SVG_NS, "path");
    SelectionOutline.#applyDashStyle(
      inline,
      brush.colorInline,
      6
    );
    svg.appendChild(inline);

    return [outline, inline];
  }

  static #applyDashStyle(
    el: SVGRectElement | SVGPathElement,
    stroke: string,
    dashOffset: number
  ): void {
    Object.assign(el.style, {
      pointerEvents: "none",
      fill: "none",
      strokeWidth: 2
    });
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-dasharray", "6 6");
    if (dashOffset) {
      el.setAttribute("stroke-dashoffset", String(dashOffset));
    }
    el.setAttribute("vector-effect", "non-scaling-stroke");
    el.setAttribute("visibility", "hidden");
  }

  /**
   * Renders a rectangular selection outline.
   */
  drawRect(
    rect: SelectionRect
  ): void {
    this.#outlinePath.setAttribute("visibility", "hidden");
    this.#inlinePath.setAttribute("visibility", "hidden");

    const zoom = this.#viewport.zoom.value;
    const camera = this.#viewport.camera;
    const x = rect.x * zoom + camera.x;
    const y = rect.y * zoom + camera.y;
    const width = rect.width * zoom;
    const height = rect.height * zoom;

    for (const el of [this.#outline, this.#inline]) {
      el.setAttribute("x", String(x));
      el.setAttribute("y", String(y));
      el.setAttribute("width", String(width));
      el.setAttribute("height", String(height));
      el.setAttribute("visibility", "visible");
    }
  }

  /**
   * Renders a masked selection outline.
   */
  drawMask(
    rect: SelectionRect,
    mask: boolean[]
  ): void {
    if (mask.every(Boolean)) {
      this.drawRect(rect);

      return;
    }

    this.#outline.setAttribute("visibility", "hidden");
    this.#inline.setAttribute("visibility", "hidden");

    const screen = {
      zoom: this.#viewport.zoom.value,
      camera: this.#viewport.camera
    };
    const loops = traceSelectionContour(
      rect.width,
      rect.height,
      mask
    );
    const d = loops
      .map((loop) => selectionContourPath(loop, rect, screen))
      .join(" ");

    for (const el of [this.#outlinePath, this.#inlinePath]) {
      el.setAttribute("d", d);
      el.setAttribute("visibility", "visible");
    }
  }

  clear(): void {
    this.#outline.setAttribute("visibility", "hidden");
    this.#inline.setAttribute("visibility", "hidden");
    this.#outlinePath.setAttribute("visibility", "hidden");
    this.#inlinePath.setAttribute("visibility", "hidden");
  }
}
