// Import Third-party Dependencies
import { contrastingColor } from "@jolly-pixel/color";

// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import type { ScreenProjection } from "../Viewport.ts";
import type {
  UVRegion,
  UVSlot
} from "../../uv/region/UVRegion.ts";
import type { Vec2 } from "../../types.ts";

// CONSTANTS
const kHandleSize = 7;

export class UVResizeHandles {
  #group: SVGGElement;
  #squares: SVGRectElement[] = [];

  constructor(
    group: SVGGElement
  ) {
    this.#group = group;
  }

  render(
    region: UVRegion | null,
    selectedSlot: UVSlot | null,
    view: ScreenProjection
  ): void {
    const corners = region === null ?
      [] :
      this.#cornersOf(region, selectedSlot, view);

    while (this.#squares.length > corners.length) {
      this.#squares.pop()!.remove();
    }
    if (region === null) {
      return;
    }

    const half = kHandleSize / 2;
    const fill = contrastingColor(region.color);
    corners.forEach((corner, index) => {
      const square = this.#squares[index] ?? this.#createSquare();
      square.setAttribute("x", String(corner.x - half));
      square.setAttribute("y", String(corner.y - half));
      square.setAttribute("fill", fill);
      square.setAttribute("stroke", region.color);
      this.#group.appendChild(square);
    });
  }

  destroy(): void {
    for (const square of this.#squares) {
      square.remove();
    }
    this.#squares = [];
  }

  #cornersOf(
    region: UVRegion,
    selectedSlot: UVSlot | null,
    view: ScreenProjection
  ): Vec2[] {
    const corners: Vec2[] = [];
    for (const { rect, handles } of region.resizeTargets(selectedSlot)) {
      const screen = view.toScreenRect(rect);
      const left = screen.x;
      const top = screen.y;
      const right = screen.x + screen.width;
      const bottom = screen.y + screen.height;
      const candidates = [
        { handle: "nw", x: left, y: top },
        { handle: "ne", x: right, y: top },
        { handle: "sw", x: left, y: bottom },
        { handle: "se", x: right, y: bottom }
      ] as const;
      for (const { handle, x, y } of candidates) {
        if (handles.includes(handle)) {
          corners.push({ x, y });
        }
      }
    }

    return corners;
  }

  #createSquare(): SVGRectElement {
    const square = document.createElementNS(SVG_NS, "rect");
    square.setAttribute("part", "uv-resize-handle");
    square.setAttribute("width", String(kHandleSize));
    square.setAttribute("height", String(kHandleSize));
    square.setAttribute("stroke-width", "1");
    square.style.pointerEvents = "none";
    this.#squares.push(square);

    return square;
  }
}
