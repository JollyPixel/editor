// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type {
  BrushHighlight,
  SelectionRect,
  Vec2
} from "../../types.ts";

/**
 * Renders rectangular and masked selection outlines.
 */
export class SelectionOverlay {
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
    SelectionOverlay.#applyDashStyle(outline, brush.colorOutline, 0);
    svg.appendChild(outline);

    const inline = document.createElementNS(SVG_NS, "rect");
    SelectionOverlay.#applyDashStyle(inline, brush.colorInline, 6);
    svg.appendChild(inline);

    return [outline, inline];
  }

  #initPaths(
    svg: SVGElement,
    brush: BrushHighlight
  ): [outline: SVGPathElement, inline: SVGPathElement] {
    const outline = document.createElementNS(SVG_NS, "path");
    SelectionOverlay.#applyDashStyle(outline, brush.colorOutline, 0);
    svg.appendChild(outline);

    const inline = document.createElementNS(SVG_NS, "path");
    SelectionOverlay.#applyDashStyle(inline, brush.colorInline, 6);
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
    const loops = SelectionOverlay.traceContour(
      rect.width,
      rect.height,
      mask
    );
    const d = loops
      .map((loop) => SelectionOverlay.#loopToPath(loop, rect, screen))
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

  static #loopToPath(
    loop: Vec2[],
    rect: SelectionRect,
    screen: { zoom: number; camera: Vec2; }
  ): string {
    function toScreenPoint(p: Vec2): string {
      const x = (rect.x + p.x) * screen.zoom + screen.camera.x;
      const y = (rect.y + p.y) * screen.zoom + screen.camera.y;

      return `${x} ${y}`;
    }

    return `M ${loop.map(toScreenPoint).join(" L ")} Z`;
  }

  /**
   * Traces a selection mask into closed contour loops.
   */
  static traceContour(
    width: number,
    height: number,
    mask: boolean[]
  ): Vec2[][] {
    function isSelected(
      x: number,
      y: number
    ): boolean {
      return x >= 0 && x < width && y >= 0 && y < height && mask[(y * width) + x];
    }

    const edges = new Map<string, Vec2>();
    function setEdge(from: Vec2, to: Vec2): void {
      edges.set(`${from.x},${from.y}`, to);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!mask[(y * width) + x]) {
          continue;
        }

        if (!isSelected(x, y - 1)) {
          setEdge({ x, y }, { x: x + 1, y });
        }
        if (!isSelected(x + 1, y)) {
          setEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 });
        }
        if (!isSelected(x, y + 1)) {
          setEdge({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
        }
        if (!isSelected(x - 1, y)) {
          setEdge({ x, y: y + 1 }, { x, y });
        }
      }
    }

    const loops: Vec2[][] = [];
    while (edges.size > 0) {
      const [startKey] = edges.keys();
      const [startX, startY] = startKey.split(",").map(Number);
      let current: Vec2 = {
        x: startX,
        y: startY
      };

      const points: Vec2[] = [current];
      for (;;) {
        const next = edges.get(`${current.x},${current.y}`)!;
        edges.delete(`${current.x},${current.y}`);
        if (next.x === startX && next.y === startY) {
          break;
        }
        points.push(next);
        current = next;
      }

      loops.push(SelectionOverlay.#simplifyLoop(points));
    }

    return loops;
  }

  /**
   * Removes collinear contour points.
   */
  static #simplifyLoop(
    points: Vec2[]
  ): Vec2[] {
    const result: Vec2[] = [];
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];

      const collinear = (prev.x === curr.x && curr.x === next.x) ||
        (prev.y === curr.y && curr.y === next.y);
      if (!collinear) {
        result.push(curr);
      }
    }

    return result.length > 0 ? result : points;
  }
}
