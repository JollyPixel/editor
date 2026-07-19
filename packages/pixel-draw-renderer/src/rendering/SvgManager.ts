// Import Internal Dependencies
import { SVG_NS } from "./constants.ts";
import { BrushHighlightOverlay } from "./overlays/BrushHighlightOverlay.ts";
import { LinePreviewOverlay } from "./overlays/LinePreviewOverlay.ts";
import { SelectionOverlay } from "./overlays/SelectionOverlay.ts";
import { UVOverlay } from "./overlays/UVOverlay.ts";
import type {
  DefaultViewport
} from "./Viewport.ts";
import type { UVMap } from "../uv/UVMap.ts";
import type {
  BrushHighlight
} from "../types.ts";

export interface SvgManagerOptions {
  parent: HTMLDivElement;
  viewport: DefaultViewport;
  brush: BrushHighlight;
  uvMap: UVMap;
}

/**
 * Manages SVG rendering overlays.
 */
export class SvgManager {
  #parentHtmlElement: HTMLDivElement;
  #svg: SVGElement;

  readonly brushHighlight: BrushHighlightOverlay;
  readonly linePreview: LinePreviewOverlay;
  readonly selection: SelectionOverlay;
  readonly uvOverlay: UVOverlay;

  constructor(
    options: SvgManagerOptions
  ) {
    this.#parentHtmlElement = options.parent;
    this.#svg = this.#init();

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
    this.uvOverlay = new UVOverlay(
      this.#svg,
      options.viewport,
      options.uvMap
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
