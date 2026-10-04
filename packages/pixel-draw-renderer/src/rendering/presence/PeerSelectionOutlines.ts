// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import { selectionOutlinePath } from "../overlays/selectionContour.ts";
import { PeerRegistry } from "./PeerRegistry.ts";
import { CommittedPixels } from "./CommittedPixels.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

// CONSTANTS
const kStrokeWidth = 2;
const kDashArray = "6 4";

export interface PeerSelectionOutlineState {
  rect: SelectionRect;
  /**
   * `null` for a plain rectangle, including every creating state.
   */
  mask: readonly boolean[] | null;
  color: string;
}

export class PeerSelectionOutlines extends PeerRegistry<
  PeerSelectionOutlineState,
  SVGPathElement
> {
  #svg: SVGElement;
  #viewport: DefaultViewport;

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport
  ) {
    super();
    this.#svg = svg;
    this.#viewport = viewport;
  }

  removeOverlapping(
    positions: Vec2[]
  ): void {
    const committed = new CommittedPixels(positions);
    if (!committed.isEmpty) {
      this.removeWhere((state) => committed.touches(state.rect, state.mask));
    }
  }

  protected createView(): SVGPathElement {
    const path = document.createElementNS(SVG_NS, "path");
    path.style.pointerEvents = "none";
    path.style.fill = "none";
    path.style.strokeWidth = String(kStrokeWidth);
    path.setAttribute("vector-effect", "non-scaling-stroke");
    path.setAttribute("stroke-dasharray", kDashArray);
    this.#svg.appendChild(path);

    return path;
  }

  protected renderView(
    path: SVGPathElement,
    state: PeerSelectionOutlineState
  ): void {
    path.setAttribute("d", selectionOutlinePath(state.rect, state.mask, this.#viewport));
    path.setAttribute("stroke", state.color);
  }

  protected disposeView(
    path: SVGPathElement
  ): void {
    path.remove();
  }
}
