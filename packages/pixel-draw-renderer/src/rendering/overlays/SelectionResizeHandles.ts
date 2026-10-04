// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import type {
  BrushHighlight,
  SelectionRect
} from "../../types.ts";

// CONSTANTS
const kHandleSize = 7;

export class SelectionResizeHandles {
  #squares: SVGRectElement[];

  constructor(
    svg: SVGElement,
    brush: BrushHighlight
  ) {
    this.#squares = Array.from({ length: 4 }, () => {
      const square = document.createElementNS(SVG_NS, "rect");
      square.setAttribute("data-overlay", "selection-resize-handle");
      square.setAttribute("part", "selection-resize-handle");
      square.setAttribute("width", String(kHandleSize));
      square.setAttribute("height", String(kHandleSize));
      square.setAttribute("fill", brush.colorInline);
      square.setAttribute("stroke", brush.colorOutline);
      square.setAttribute("stroke-width", "1");
      square.style.pointerEvents = "none";
      svg.appendChild(square);

      return square;
    });
    this.clear();
  }

  draw(
    screen: SelectionRect
  ): void {
    const half = kHandleSize / 2;
    this.#squares.forEach((square, index) => {
      const x = screen.x + (index % 2) * screen.width;
      const y = screen.y + Math.floor(index / 2) * screen.height;
      square.setAttribute("x", String(x - half));
      square.setAttribute("y", String(y - half));
      square.setAttribute("visibility", "visible");
    });
  }

  clear(): void {
    for (const square of this.#squares) {
      square.setAttribute("visibility", "hidden");
    }
  }
}
