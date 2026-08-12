// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import {
  selectionContourPath,
  traceSelectionContour
} from "../overlays/selectionContour.ts";
import { PeerRegistry } from "./PeerRegistry.ts";
import {
  positionKeySet,
  rectOverlapsPositionKeys
} from "../../utils/math.ts";
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
  mask: boolean[] | null;
  color: string;
}

/**
 * Dashed peer-colored selection boundary.
 * Uses a plain rect when mask is absent/all-true, otherwise traces
 * the mask contour so shape/rotated selections show their real outline.
 */
class PeerSelectionBorder {
  #rect: SVGRectElement;
  #path: SVGPathElement;

  constructor() {
    this.#rect = document.createElementNS(SVG_NS, "rect");
    this.#path = document.createElementNS(SVG_NS, "path");
    PeerSelectionBorder.#applyBaseStyle(this.#rect);
    PeerSelectionBorder.#applyBaseStyle(this.#path);
  }

  static #applyBaseStyle(
    el: SVGRectElement | SVGPathElement
  ): void {
    el.style.pointerEvents = "none";
    el.style.fill = "none";
    el.setAttribute("vector-effect", "non-scaling-stroke");
    el.setAttribute("stroke-dasharray", kDashArray);
    el.setAttribute("visibility", "hidden");
  }

  place(
    rect: SelectionRect,
    mask: boolean[] | null,
    viewport: DefaultViewport
  ): void {
    const zoom = viewport.zoom.value;
    const camera = viewport.camera;

    if (!mask || mask.every(Boolean)) {
      this.#path.setAttribute("visibility", "hidden");

      this.#rect.setAttribute(
        "x",
        String(rect.x * zoom + camera.x)
      );
      this.#rect.setAttribute(
        "y",
        String(rect.y * zoom + camera.y)
      );
      this.#rect.setAttribute(
        "width",
        String(rect.width * zoom)
      );
      this.#rect.setAttribute(
        "height",
        String(rect.height * zoom)
      );
      this.#rect.setAttribute("visibility", "visible");

      return;
    }

    this.#rect.setAttribute("visibility", "hidden");

    const loops = traceSelectionContour(
      rect.width,
      rect.height,
      mask
    );
    const d = loops
      .map((loop) => selectionContourPath(
        loop,
        rect,
        { zoom, camera }
      ))
      .join(" ");

    this.#path.setAttribute("d", d);
    this.#path.setAttribute("visibility", "visible");
  }

  paint(
    color: string
  ): void {
    for (const el of [this.#rect, this.#path]) {
      el.setAttribute("stroke", color);
      el.style.strokeWidth = String(kStrokeWidth);
    }
  }

  appendTo(
    svg: SVGElement
  ): void {
    svg.appendChild(this.#rect);
    svg.appendChild(this.#path);
  }

  remove(): void {
    this.#rect.remove();
    this.#path.remove();
  }
}

/**
 * Renders non-authoritative peer selection boundaries.
 */
export class PeerSelectionOutlines extends PeerRegistry<
  PeerSelectionOutlineState,
  PeerSelectionBorder
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

  get isActive(): boolean {
    return this.size > 0;
  }

  /**
   * Matches content because presence and command peer ids may differ.
   */
  removeOverlapping(
    positions: Vec2[]
  ): void {
    if (positions.length === 0) {
      return;
    }

    const committed = positionKeySet(positions);
    for (const [clientId, state] of [...this.entries()]) {
      const { rect, mask } = state;

      const isRectOverlapping = rectOverlapsPositionKeys(
        rect,
        mask,
        committed
      );
      if (isRectOverlapping) {
        this.remove(clientId);
      }
    }
  }

  protected render(
    clientId: string,
    state: PeerSelectionOutlineState
  ): void {
    const border = this.view(
      clientId
    ) ?? this.#createBorder(clientId);
    border.place(
      state.rect,
      state.mask,
      this.#viewport
    );
    border.paint(state.color);
    border.appendTo(this.#svg);
  }

  protected disposeView(
    view: PeerSelectionBorder
  ): void {
    view.remove();
  }

  #createBorder(
    clientId: string
  ): PeerSelectionBorder {
    const border = new PeerSelectionBorder();
    this.setView(
      clientId,
      border
    );

    return border;
  }
}
