// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type {
  BrushHighlight,
  Vec2
} from "../../types.ts";

/**
 * Renders the Shift-to-line preview as a single straight segment through the
 * centers of the start/end texture pixels — a lightweight indicator of the
 * line's path, not a preview of every pixel it will stamp.
 *
 * A wider "casing" line (colorOutline) behind a narrower one (colorInline) on
 * the same path — unlike the brush highlight's adjacent-border trick, a
 * single segment needs differing stroke widths to read as a halo.
 */
export class LinePreviewOverlay {
  #viewport: DefaultViewport;
  #outline: SVGLineElement;
  #inline: SVGLineElement;

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
  ): [outline: SVGLineElement, inline: SVGLineElement] {
    const defaultStyle = {
      pointerEvents: "none",
      fill: "none"
    };

    const outline = document.createElementNS(SVG_NS, "line");
    Object.assign(outline.style, defaultStyle, { strokeWidth: 4 });
    outline.setAttribute("stroke", brush.colorOutline);
    outline.setAttribute("vector-effect", "non-scaling-stroke");
    outline.setAttribute("visibility", "hidden");
    svg.appendChild(outline);

    const inline = document.createElementNS(SVG_NS, "line");
    Object.assign(inline.style, defaultStyle, { strokeWidth: 2 });
    inline.setAttribute("stroke", brush.colorInline);
    inline.setAttribute("vector-effect", "non-scaling-stroke");
    inline.setAttribute("visibility", "hidden");
    svg.appendChild(inline);

    return [outline, inline];
  }

  setLine(
    start: Vec2,
    end: Vec2
  ): void {
    const zoom = this.#viewport.zoom;
    const camera = this.#viewport.camera;
    const x1 = (start.x + 0.5) * zoom + camera.x;
    const y1 = (start.y + 0.5) * zoom + camera.y;
    const x2 = (end.x + 0.5) * zoom + camera.x;
    const y2 = (end.y + 0.5) * zoom + camera.y;

    for (const line of [this.#outline, this.#inline]) {
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("visibility", "visible");
    }
  }

  clear(): void {
    this.#outline.setAttribute("visibility", "hidden");
    this.#inline.setAttribute("visibility", "hidden");
  }
}
