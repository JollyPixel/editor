// Import Internal Dependencies
import type { Brush, DefaultViewport, Vec2 } from "./types.ts";

// CONSTANTS
const kSvgNs = "http://www.w3.org/2000/svg";

export interface SvgManagerOptions {
  parent: HTMLDivElement;
  viewport: DefaultViewport;
  brush: Brush;
  /**
   * The size of the texture. This is required to correctly position the SVG highlights.
   */
  textureSize: Vec2;
}

/**
 * SvgManager is responsible for managing an SVG overlay on top of the canvas.
 * It is used to render brush highlights and other visual aids that require vector graphics.
 * The manager creates an SVG element that covers the entire canvas and updates its content based on the viewport and brush properties.
 * It provides methods to update the brush highlight position, hide the highlight, and draw UVs for debugging purposes.
 */
export class SvgManager {
  #parentHtmlElement: HTMLDivElement;
  #viewport: DefaultViewport;
  #brush: Brush;
  #textureSize: Vec2;
  #svg: SVGElement;
  #highlightElements: SVGGElement;

  constructor(
    options: SvgManagerOptions
  ) {
    this.#parentHtmlElement = options.parent;
    this.#viewport = options.viewport;
    this.#brush = options.brush;
    this.#textureSize = options.textureSize;

    this.#svg = this.#initSvgElement();
    this.#highlightElements = this.#initBrushHighlight();
  }

  #initSvgElement(): SVGElement {
    const svg = document.createElementNS(kSvgNs, "svg");

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
    svg.setAttribute("width", String(boundingRect.width));
    svg.setAttribute("height", String(boundingRect.height));

    this.#parentHtmlElement.appendChild(svg);

    return svg;
  }

  #initBrushHighlight(): SVGGElement {
    const highlightGroupElement = document.createElementNS(kSvgNs, "g");

    const defaultStyle = {
      pointerEvents: "none",
      strokeWidth: 2
    };

    const highlightElementInLine = document.createElementNS(kSvgNs, "rect");
    Object.assign(highlightElementInLine.style, defaultStyle);
    highlightElementInLine.setAttribute("stroke", this.#brush.colorInline);
    highlightElementInLine.setAttribute("fill", "none");
    highlightElementInLine.setAttribute("x", "0.01");
    highlightElementInLine.setAttribute("y", "0.01");
    highlightElementInLine.setAttribute("width", "0.98");
    highlightElementInLine.setAttribute("height", "0.98");
    highlightElementInLine.setAttribute("vector-effect", "non-scaling-stroke");
    highlightGroupElement.appendChild(highlightElementInLine);

    const highlightElementOutLine = document.createElementNS(kSvgNs, "rect");
    Object.assign(highlightElementOutLine.style, defaultStyle);
    highlightElementOutLine.setAttribute("stroke", this.#brush.colorOutline);
    highlightElementOutLine.setAttribute("fill", "none");
    highlightElementOutLine.setAttribute("width", "1");
    highlightElementOutLine.setAttribute("height", "1");
    highlightElementOutLine.setAttribute("vector-effect", "non-scaling-stroke");
    highlightGroupElement.appendChild(highlightElementOutLine);

    highlightGroupElement.setAttribute("visibility", "hidden");
    this.#svg.appendChild(highlightGroupElement);

    return highlightGroupElement;
  }

  updateBrushHighlight(
    x: number | null,
    y: number | null
  ): void {
    if (x === null || y === null) {
      this.hideSvgHighlight();

      return;
    }

    const zoom = this.#viewport.zoom;
    const camera = this.#viewport.camera;
    const brushSize = this.#brush.size;
    const highlightBrushSize = brushSize * zoom;

    const offsetX = camera.x % zoom;
    const offsetY = camera.y % zoom;

    const gridedX = x - (x - offsetX) % zoom;
    const gridedY = y - (y - offsetY) % zoom;

    let translate = "translate";
    if (brushSize % 2 === 0) {
      translate += `(${gridedX - highlightBrushSize / 2}, ${gridedY - highlightBrushSize / 2})`;
    }
    else {
      translate += `(${gridedX - highlightBrushSize / 2 + zoom / 2}, ${gridedY - highlightBrushSize / 2 + zoom / 2})`;
    }
    this.#highlightElements.setAttribute("transform", `${translate} scale(${highlightBrushSize})`);
    this.#highlightElements.setAttribute("visibility", "visible");
  }

  getSvgElement(): SVGElement {
    return this.#svg;
  }

  hideSvgHighlight(): void {
    this.#highlightElements.setAttribute("visibility", "hidden");
  }

  updateSvgSize(
    width: number,
    height: number
  ): void {
    this.#svg.setAttribute("width", String(width));
    this.#svg.setAttribute("height", String(height));
  }

  setTextureSize(
    size: Vec2
  ): void {
    this.#textureSize = size;
  }

  destroy(): void {
    if (this.#svg.parentElement) {
      this.#svg.remove();
    }
  }

  reparentSvgTo(
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

  drawUVs(
    UVs: number[]
  ): void {
    const pixelUvValue = { x: 1 / this.#textureSize.x, y: 1 / this.#textureSize.y };
    const defaultStyle = {
      pointerEvents: "none",
      strokeWidth: 2
    };

    for (let i = 0; i < UVs.length; i += 12) {
      const uvHighLight = document.createElementNS(kSvgNs, "rect");
      Object.assign(uvHighLight.style, defaultStyle);
      uvHighLight.setAttribute("stroke", "red");
      uvHighLight.setAttribute("fill", "none");
      uvHighLight.setAttribute("x", String(UVs[i]));
      uvHighLight.setAttribute("y", "0.01");
      uvHighLight.setAttribute("width", String(UVs[i] * pixelUvValue.x));
      uvHighLight.setAttribute("height", String(UVs[i + 1] * pixelUvValue.y));
      uvHighLight.setAttribute("vector-effect", "non-scaling-stroke");
      this.#svg.appendChild(uvHighLight);
    }
  }
}
