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
  #cursorX: number | null = null;
  #cursorY: number | null = null;

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
    highlightGroupElement.setAttribute(
      "data-overlay",
      "brush-highlight"
    );

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
    this.#cursorX = x;
    this.#cursorY = y;
    this.refresh();
  }

  /** Repaints the current cursor position using the latest brush size. */
  refresh(): void {
    if (this.#cursorX === null || this.#cursorY === null) {
      this.hide();

      return;
    }

    const zoom = this.#viewport.zoom.value;
    const camera = this.#viewport.camera;
    const brushSize = this.#brush.size;
    const highlightBrushSize = brushSize * zoom;

    const offsetX = camera.x % zoom;
    const offsetY = camera.y % zoom;

    const gridedX = this.#cursorX - (this.#cursorX - offsetX) % zoom;
    const gridedY = this.#cursorY - (this.#cursorY - offsetY) % zoom;

    let translate = "translate";
    if (brushSize % 2 === 0) {
      const translateX = gridedX - highlightBrushSize / 2;
      const translateY = gridedY - highlightBrushSize / 2;

      translate += `(${translateX}, ${translateY})`;
    }
    else {
      const translateX = gridedX - highlightBrushSize / 2 + zoom / 2;
      const translateY = gridedY - highlightBrushSize / 2 + zoom / 2;

      translate += `(${translateX}, ${translateY})`;
    }
    this.#group.setAttribute(
      "transform",
      `${translate} scale(${highlightBrushSize})`
    );
    this.#group.setAttribute("visibility", "visible");
  }

  hide(): void {
    this.#group.setAttribute("visibility", "hidden");
  }
}
