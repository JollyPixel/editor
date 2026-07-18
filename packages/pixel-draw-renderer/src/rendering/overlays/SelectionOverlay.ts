// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type {
  BrushHighlight,
  SelectionRect
} from "../../types.ts";

/**
 * Renders the current select-mode selection rectangle (texture-space `rect`,
 * converted to screen space via zoom/camera like every other overlay here)
 * as a two-color dashed rectangle border ("marching ants"): both rects share
 * the same dash length, offset by half a cycle from each other, so the gaps
 * in one are filled by the other's dashes instead of the background showing
 * through. Call `drawRect` again on every pan/zoom/drag update to reposition.
 */
export class SelectionOverlay {
  #viewport: DefaultViewport;
  #outline: SVGRectElement;
  #inline: SVGRectElement;

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    brush: BrushHighlight
  ) {
    this.#viewport = viewport;
    const [outline, inline] = this.#init(svg, brush);
    this.#outline = outline;
    this.#inline = inline;
  }

  #init(
    svg: SVGElement,
    brush: BrushHighlight
  ): [outline: SVGRectElement, inline: SVGRectElement] {
    const defaultStyle = {
      pointerEvents: "none",
      fill: "none",
      strokeWidth: 2
    };

    const outline = document.createElementNS(SVG_NS, "rect");
    Object.assign(outline.style, defaultStyle);
    outline.setAttribute("stroke", brush.colorOutline);
    outline.setAttribute("stroke-dasharray", "6 6");
    outline.setAttribute("vector-effect", "non-scaling-stroke");
    outline.setAttribute("visibility", "hidden");
    svg.appendChild(outline);

    const inline = document.createElementNS(SVG_NS, "rect");
    Object.assign(inline.style, defaultStyle);
    inline.setAttribute("stroke", brush.colorInline);
    inline.setAttribute("stroke-dasharray", "6 6");
    inline.setAttribute("stroke-dashoffset", "6");
    inline.setAttribute("vector-effect", "non-scaling-stroke");
    inline.setAttribute("visibility", "hidden");
    svg.appendChild(inline);

    return [outline, inline];
  }

  drawRect(
    rect: SelectionRect
  ): void {
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

  clear(): void {
    this.#outline.setAttribute("visibility", "hidden");
    this.#inline.setAttribute("visibility", "hidden");
  }
}
