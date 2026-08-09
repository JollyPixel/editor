// Import Internal Dependencies
import { SVG_NS } from "./constants.ts";
import { BrushHighlightOverlay } from "./overlays/BrushHighlightOverlay.ts";
import { LinePreviewOverlay } from "./overlays/LinePreviewOverlay.ts";
import { SelectionOverlay } from "./overlays/SelectionOverlay.ts";
import { UVOverlay } from "./overlays/UVOverlay.ts";
import { PeerCursorOverlay } from "./overlays/PeerCursorOverlay.ts";
import { PeerUVGhosts } from "./overlays/PeerUVGhosts.ts";
import type {
  DefaultViewport
} from "./Viewport.ts";
import type { UVMap } from "../uv/UVMap.ts";
import type {
  BrushHighlight
} from "../types.ts";

export interface OverlayLayerOptions {
  parent: HTMLDivElement;
  viewport: DefaultViewport;
  brush: BrushHighlight;
  uvMap: UVMap;
}

/**
 * Owns the SVG element and the camera-aligned overlays drawn over the canvas.
 * UV is created first so tool overlays paint above its region borders.
 */
export class OverlayLayer {
  #parentHtmlElement: HTMLDivElement;
  #svg: SVGElement;

  readonly brushHighlight: BrushHighlightOverlay;
  readonly linePreview: LinePreviewOverlay;
  readonly selection: SelectionOverlay;
  readonly uvOverlay: UVOverlay;
  readonly peerCursors: PeerCursorOverlay;
  readonly peerUvGhosts: PeerUVGhosts;

  constructor(
    options: OverlayLayerOptions
  ) {
    this.#parentHtmlElement = options.parent;
    this.#svg = this.#init();

    this.uvOverlay = new UVOverlay(
      this.#svg,
      options.viewport,
      options.uvMap
    );
    this.peerUvGhosts = new PeerUVGhosts(
      this.#svg,
      options.viewport,
      this.uvOverlay
    );
    this.brushHighlight = new BrushHighlightOverlay(
      this.#svg,
      options.viewport,
      options.brush
    );
    this.linePreview = new LinePreviewOverlay(
      this.#svg,
      options.viewport,
      options.brush
    );
    this.selection = new SelectionOverlay(
      this.#svg,
      options.viewport,
      options.brush
    );
    this.peerCursors = new PeerCursorOverlay(
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

  destroy(): void {
    this.uvOverlay.destroy();
    this.peerCursors.destroy();
    this.peerUvGhosts.destroy();
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
