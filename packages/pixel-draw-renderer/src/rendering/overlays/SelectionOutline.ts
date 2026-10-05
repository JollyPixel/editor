// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import { selectionOutlinePath } from "./selectionContour.ts";
import { SizeLabel } from "./SizeLabel.ts";
import { SelectionResizeHandles } from "./SelectionResizeHandles.ts";
import type {
  DefaultViewport
} from "../Viewport.ts";
import type {
  BrushHighlight,
  SelectionRect
} from "../../types.ts";

// CONSTANTS
const kMinLabelledSize = 2;

export interface SelectionOutlineOptions {
  /**
   * Whether the outline shows the selection size next to it.
   * @default true
   */
  sizeLabel?: boolean;
}

export class SelectionOutline {
  #viewport: DefaultViewport;
  #paths: [outline: SVGPathElement, inline: SVGPathElement];
  #sizeLabel: SizeLabel | null;
  #resizeHandles: SelectionResizeHandles;

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    brush: BrushHighlight,
    options: SelectionOutlineOptions = {}
  ) {
    this.#viewport = viewport;
    this.#paths = [
      SelectionOutline.#createPath(svg, brush.colorOutline, 0),
      SelectionOutline.#createPath(svg, brush.colorInline, 6)
    ];
    this.#sizeLabel = options.sizeLabel === false
      ? null
      : new SizeLabel(viewport, {
        overlay: "selection-size",
        fill: brush.colorOutline,
        stroke: brush.colorInline
      });
    this.#sizeLabel?.appendTo(svg);
    this.#resizeHandles = new SelectionResizeHandles(svg, brush);
  }

  draw(
    rect: SelectionRect,
    mask: readonly boolean[] | null = null,
    resizable = false
  ): void {
    const d = selectionOutlinePath(rect, mask, this.#viewport);
    for (const path of this.#paths) {
      path.setAttribute("d", d);
      path.setAttribute("visibility", "visible");
    }

    this.#sizeLabel?.show(
      rect.width < kMinLabelledSize || rect.height < kMinLabelledSize
        ? null
        : this.#sizeLabel.outside(rect)
    );
    if (resizable) {
      this.#resizeHandles.draw(
        this.#viewport.toScreenRect(rect)
      );
    }
    else {
      this.#resizeHandles.clear();
    }
  }

  clear(): void {
    for (const path of this.#paths) {
      path.setAttribute("visibility", "hidden");
    }
    this.#sizeLabel?.clear();
    this.#resizeHandles.clear();
  }

  static #createPath(
    svg: SVGElement,
    stroke: string,
    dashOffset: number
  ): SVGPathElement {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("data-overlay", "selection");
    Object.assign(path.style, {
      pointerEvents: "none",
      fill: "none",
      strokeWidth: 2
    });
    path.setAttribute("stroke", stroke);
    path.setAttribute("stroke-dasharray", "6 6");
    if (dashOffset) {
      path.setAttribute("stroke-dashoffset", String(dashOffset));
    }
    path.setAttribute("vector-effect", "non-scaling-stroke");
    path.setAttribute("visibility", "hidden");
    svg.appendChild(path);

    return path;
  }
}
