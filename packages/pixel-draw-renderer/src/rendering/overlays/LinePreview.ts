// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import type {
  DefaultViewport
} from "../Viewport.ts";
import type {
  BrushHighlight,
  Vec2
} from "../../types.ts";

export class LinePreview {
  #viewport: DefaultViewport;
  #outline: SVGLineElement;
  #inline: SVGLineElement;

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    brush: BrushHighlight
  ) {
    this.#viewport = viewport;

    const [outline, inline] = this.#init(
      svg,
      brush
    );
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
    Object.assign(
      outline.style,
      defaultStyle,
      { strokeWidth: 4 }
    );
    outline.setAttribute("stroke", brush.colorOutline);
    outline.setAttribute("vector-effect", "non-scaling-stroke");
    outline.setAttribute("visibility", "hidden");
    svg.appendChild(outline);

    const inline = document.createElementNS(SVG_NS, "line");
    Object.assign(
      inline.style,
      defaultStyle,
      { strokeWidth: 2 }
    );
    inline.setAttribute("stroke", brush.colorInline);
    inline.setAttribute("vector-effect", "non-scaling-stroke");
    inline.setAttribute("visibility", "hidden");
    svg.appendChild(inline);

    return [outline, inline];
  }

  drawLine(
    start: Vec2,
    end: Vec2
  ): void {
    const from = this.#viewport.toScreen({ x: start.x + 0.5, y: start.y + 0.5 });
    const to = this.#viewport.toScreen({ x: end.x + 0.5, y: end.y + 0.5 });

    for (const line of [this.#outline, this.#inline]) {
      line.setAttribute("x1", String(from.x));
      line.setAttribute("y1", String(from.y));
      line.setAttribute("x2", String(to.x));
      line.setAttribute("y2", String(to.y));
      line.setAttribute("visibility", "visible");
    }
  }

  clear(): void {
    this.#outline.setAttribute(
      "visibility",
      "hidden"
    );
    this.#inline.setAttribute(
      "visibility",
      "hidden"
    );
  }
}
