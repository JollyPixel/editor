// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import { PeerCursors } from "../presence/PeerCursors.ts";
import { PeerSelectionOutlines } from "../presence/PeerSelectionOutlines.ts";
import { PeerUVPreview } from "../presence/PeerUVPreview.ts";
import { BrushHighlightView } from "./BrushHighlight.ts";
import { LinePreview } from "./LinePreview.ts";
import { SelectionOutline } from "./SelectionOutline.ts";
import { UVRegionLayer } from "./UVRegions.ts";
import type {
  DefaultViewport
} from "../Viewport.ts";
import type { UVMap } from "../../uv/UVMap.ts";
import type {
  BrushHighlight
} from "../../types.ts";

export interface OverlayLayerOptions {
  parent: HTMLDivElement;
  viewport: DefaultViewport;
  brush: BrushHighlight;
  uvMap: UVMap;
  /**
   * Whether the selection outline shows its size.
   * @default true
   */
  selectionSizeLabel?: boolean;
}

/**
 * Creates UV first so tool overlays paint above region borders.
 */
export class OverlayLayer {
  #parentHtmlElement: HTMLDivElement;
  #svg: SVGElement;

  readonly brushHighlight: BrushHighlightView;
  readonly linePreview: LinePreview;
  readonly selection: SelectionOutline;
  readonly uvOverlay: UVRegionLayer;
  readonly peerCursors: PeerCursors;
  readonly peerUvPreview: PeerUVPreview;
  readonly peerSelectionOutlines: PeerSelectionOutlines;

  constructor(
    options: OverlayLayerOptions
  ) {
    this.#parentHtmlElement = options.parent;
    this.#svg = this.#init();

    this.uvOverlay = new UVRegionLayer(
      this.#svg,
      options.viewport,
      options.uvMap
    );
    this.peerUvPreview = new PeerUVPreview(
      this.#svg,
      options.viewport,
      this.uvOverlay
    );
    this.brushHighlight = new BrushHighlightView(
      this.#svg,
      options.viewport,
      options.brush
    );
    this.linePreview = new LinePreview(
      this.#svg,
      options.viewport,
      options.brush
    );
    this.selection = new SelectionOutline(
      this.#svg,
      options.viewport,
      options.brush,
      { sizeLabel: options.selectionSizeLabel }
    );
    this.peerCursors = new PeerCursors(
      this.#svg,
      options.viewport
    );
    this.peerSelectionOutlines = new PeerSelectionOutlines(
      this.#svg,
      options.viewport
    );
  }

  #init(): SVGElement {
    const svg = document.createElementNS(SVG_NS, "svg");

    Object.assign(svg.style, {
      width: "100%",
      height: "100%",
      position: "absolute",
      top: "0",
      left: "0",
      zIndex: "1",
      pointerEvents: "none"
    });

    const boundingRect = this.#parentHtmlElement.getBoundingClientRect();
    svg.setAttribute(
      "width",
      String(boundingRect.width)
    );
    svg.setAttribute(
      "height",
      String(boundingRect.height)
    );

    this.#parentHtmlElement.appendChild(svg);

    return svg;
  }

  resize(
    width: number,
    height: number
  ): void {
    this.#svg.setAttribute(
      "width",
      String(width)
    );
    this.#svg.setAttribute(
      "height",
      String(height)
    );
  }

  refresh(): void {
    this.brushHighlight.refresh();
    this.uvOverlay.refresh();
  }

  destroy(): void {
    this.uvOverlay.destroy();
    if (this.#svg.parentElement) {
      this.#svg.remove();
    }
  }

  reparentTo(
    newParentElement: HTMLDivElement
  ): void {
    if (!this.#svg) {
      return;
    }

    if (this.#svg.parentElement) {
      this.#svg.remove();
    }

    newParentElement.appendChild(this.#svg);
    this.#parentHtmlElement = newParentElement;
  }
}
