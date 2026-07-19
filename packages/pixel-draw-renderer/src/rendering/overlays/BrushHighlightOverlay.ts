// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import type {
  DefaultViewport
} from "../Viewport.ts";
import type {
  BrushHighlight
} from "../../types.ts";

/**
 * Renders the brush cursor overlay.
 */
export class BrushHighlightOverlay {
  #viewport: DefaultViewport;
  #brush: BrushHighlight;
  #group: SVGGElement;

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    brush: BrushHighlight
  ) {
    this.#viewport = viewport;
    this.#brush = brush;
    this.#group = this.#init(svg);
  }

  #init(
    svg: SVGElement
  ): SVGGElement {
    const highlightGroupElement = document.createElementNS(SVG_NS, "g");

    const defaultStyle = {
      pointerEvents: "none",
      strokeWidth: 2
    };

    const highlightElementInLine = document.createElementNS(SVG_NS, "rect");
    Object.assign(highlightElementInLine.style, defaultStyle);
    highlightElementInLine.setAttribute("stroke", this.#brush.colorInline);
    highlightElementInLine.setAttribute("fill", "none");
    highlightElementInLine.setAttribute("x", "0.01");
    highlightElementInLine.setAttribute("y", "0.01");
    highlightElementInLine.setAttribute("width", "0.98");
    highlightElementInLine.setAttribute("height", "0.98");
    highlightElementInLine.setAttribute("vector-effect", "non-scaling-stroke");
    highlightGroupElement.appendChild(highlightElementInLine);

    const highlightElementOutLine = document.createElementNS(SVG_NS, "rect");
    Object.assign(highlightElementOutLine.style, defaultStyle);
    highlightElementOutLine.setAttribute("stroke", this.#brush.colorOutline);
    highlightElementOutLine.setAttribute("fill", "none");
    highlightElementOutLine.setAttribute("width", "1");
    highlightElementOutLine.setAttribute("height", "1");
    highlightElementOutLine.setAttribute("vector-effect", "non-scaling-stroke");
    highlightGroupElement.appendChild(highlightElementOutLine);

    highlightGroupElement.setAttribute("visibility", "hidden");
    svg.appendChild(highlightGroupElement);

    return highlightGroupElement;
  }

  update(
    x: number | null,
    y: number | null
  ): void {
    if (x === null || y === null) {
      this.hide();

      return;
    }

    const zoom = this.#viewport.zoom.value;
    const camera = this.#viewport.camera;
    const brushSize = this.#brush.size;
    const highlightBrushSize = brushSize * zoom;

    const offsetX = camera.x % zoom;
    const offsetY = camera.y % zoom;

    const gridedX = x - (x - offsetX) % zoom;
    const gridedY = y - (y - offsetY) % zoom;

    let translate = "translate";
    if (brushSize % 2 === 0) {
      translate += `(${gridedX - highlightBrushSize / 2}, ${gridedY - highlightBrushSize / 2})`;
    }
    else {
      translate += `(${gridedX - highlightBrushSize / 2 + zoom / 2}, ${gridedY - highlightBrushSize / 2 + zoom / 2})`;
    }
    this.#group.setAttribute("transform", `${translate} scale(${highlightBrushSize})`);
    this.#group.setAttribute("visibility", "visible");
  }

  hide(): void {
    this.#group.setAttribute("visibility", "hidden");
  }
}
