// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import { PeerCursors } from "../presence/PeerCursors.ts";
import { PeerSelectionOutlines } from "../presence/PeerSelectionOutlines.ts";
import { PeerUVPreview } from "../presence/PeerUVPreview.ts";
import { PeerUVSelections } from "../presence/PeerUVSelections.ts";
import { BrushHighlightView } from "./BrushHighlight.ts";
import { LinePreview } from "./LinePreview.ts";
import { SelectionOutline } from "./SelectionOutline.ts";
import { UVRegionLayer } from "./UVRegions.ts";
import type {
  DefaultViewport
} from "../Viewport.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
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

export class OverlayLayer {
  #parentHtmlElement: HTMLDivElement;
  #svg: SVGElement;

  readonly brushHighlight: BrushHighlightView;
  readonly linePreview: LinePreview;
  readonly selection: SelectionOutline;
  readonly uvOverlay: UVRegionLayer;
  readonly peerCursors: PeerCursors;
  readonly peerUvPreview: PeerUVPreview;
  readonly peerUvSelections: PeerUVSelections;
  readonly peerSelectionOutlines: PeerSelectionOutlines;

  constructor(
    options: OverlayLayerOptions
  ) {
    const { viewport, brush } = options;
    this.#parentHtmlElement = options.parent;
    this.#svg = this.#init();

    const [
      uvGroup,
      peerSelectionGroup,
      brushGroup,
      lineGroup,
      selectionGroup,
      cursorGroup
    ] = OverlayLayer.#layers(this.#svg, [
      "uv",
      "peer-selections",
      "brush",
      "line",
      "selection",
      "peer-cursors"
    ]);

    this.uvOverlay = new UVRegionLayer(uvGroup, viewport, options.uvMap);
    this.peerUvPreview = new PeerUVPreview(this.uvOverlay);
    this.peerUvSelections = new PeerUVSelections(this.uvOverlay);
    this.peerSelectionOutlines = new PeerSelectionOutlines(peerSelectionGroup, viewport);
    this.brushHighlight = new BrushHighlightView(brushGroup, viewport, brush);
    this.linePreview = new LinePreview(lineGroup, viewport, brush);
    this.selection = new SelectionOutline(
      selectionGroup,
      viewport,
      brush,
      { sizeLabel: options.selectionSizeLabel }
    );
    this.peerCursors = new PeerCursors(cursorGroup, viewport);
  }

  static #layers(
    svg: SVGElement,
    names: readonly string[]
  ): SVGGElement[] {
    return names.map((name) => {
      const group = document.createElementNS(SVG_NS, "g");
      group.setAttribute("data-layer", name);
      svg.appendChild(group);

      return group;
    });
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
    if (this.#svg.parentElement) {
      this.#svg.remove();
    }

    newParentElement.appendChild(this.#svg);
    this.#parentHtmlElement = newParentElement;
  }
}
