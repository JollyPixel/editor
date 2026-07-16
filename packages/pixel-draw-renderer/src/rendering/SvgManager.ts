// Import Internal Dependencies
import type { Brush, DefaultViewport, SelectionRect, Vec2 } from "../types.ts";

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
  #linePreviewOutline: SVGLineElement;
  #linePreviewInline: SVGLineElement;
  #selectionOutline: SVGRectElement;
  #selectionInline: SVGRectElement;

  constructor(
    options: SvgManagerOptions
  ) {
    this.#parentHtmlElement = options.parent;
    this.#viewport = options.viewport;
    this.#brush = options.brush;
    this.#textureSize = options.textureSize;

    this.#svg = this.#initSvgElement();
    this.#highlightElements = this.#initBrushHighlight();
    const [outline, inline] = this.#initLinePreview();
    this.#linePreviewOutline = outline;
    this.#linePreviewInline = inline;
    const [selOutline, selInline] = this.#initSelectionRect();
    this.#selectionOutline = selOutline;
    this.#selectionInline = selInline;
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

  /**
   * A wider "casing" line (colorOutline) behind a narrower one (colorInline)
   * on the same path — unlike the brush highlight's adjacent-border trick,
   * a single segment needs differing stroke widths to read as a halo.
   */
  #initLinePreview(): [outline: SVGLineElement, inline: SVGLineElement] {
    const defaultStyle = {
      pointerEvents: "none",
      fill: "none"
    };

    const outline = document.createElementNS(kSvgNs, "line");
    Object.assign(outline.style, defaultStyle, { strokeWidth: 4 });
    outline.setAttribute("stroke", this.#brush.colorOutline);
    outline.setAttribute("vector-effect", "non-scaling-stroke");
    outline.setAttribute("visibility", "hidden");
    this.#svg.appendChild(outline);

    const inline = document.createElementNS(kSvgNs, "line");
    Object.assign(inline.style, defaultStyle, { strokeWidth: 2 });
    inline.setAttribute("stroke", this.#brush.colorInline);
    inline.setAttribute("vector-effect", "non-scaling-stroke");
    inline.setAttribute("visibility", "hidden");
    this.#svg.appendChild(inline);

    return [outline, inline];
  }

  /**
   * A two-color dashed rectangle border ("marching ants"): both rects share
   * the same dash length, offset by half a cycle from each other, so the
   * gaps in one are filled by the other's dashes instead of the background
   * showing through.
   */
  #initSelectionRect(): [outline: SVGRectElement, inline: SVGRectElement] {
    const defaultStyle = {
      pointerEvents: "none",
      fill: "none",
      strokeWidth: 2
    };

    const outline = document.createElementNS(kSvgNs, "rect");
    Object.assign(outline.style, defaultStyle);
    outline.setAttribute("stroke", this.#brush.colorOutline);
    outline.setAttribute("stroke-dasharray", "6 6");
    outline.setAttribute("vector-effect", "non-scaling-stroke");
    outline.setAttribute("visibility", "hidden");
    this.#svg.appendChild(outline);

    const inline = document.createElementNS(kSvgNs, "rect");
    Object.assign(inline.style, defaultStyle);
    inline.setAttribute("stroke", this.#brush.colorInline);
    inline.setAttribute("stroke-dasharray", "6 6");
    inline.setAttribute("stroke-dashoffset", "6");
    inline.setAttribute("vector-effect", "non-scaling-stroke");
    inline.setAttribute("visibility", "hidden");
    this.#svg.appendChild(inline);

    return [outline, inline];
  }

  /**
   * Renders the current select-mode selection rectangle (texture-space
   * `rect`, converted to screen space via zoom/camera like every other
   * overlay here). Call again on every pan/zoom/drag update to reposition.
   */
  setSelectionRect(
    rect: SelectionRect
  ): void {
    const zoom = this.#viewport.zoom;
    const camera = this.#viewport.camera;
    const x = rect.x * zoom + camera.x;
    const y = rect.y * zoom + camera.y;
    const width = rect.width * zoom;
    const height = rect.height * zoom;

    for (const el of [this.#selectionOutline, this.#selectionInline]) {
      el.setAttribute("x", String(x));
      el.setAttribute("y", String(y));
      el.setAttribute("width", String(width));
      el.setAttribute("height", String(height));
      el.setAttribute("visibility", "visible");
    }
  }

  clearSelectionRect(): void {
    this.#selectionOutline.setAttribute("visibility", "hidden");
    this.#selectionInline.setAttribute("visibility", "hidden");
  }

  /**
   * Renders the Shift-to-line preview as a single straight segment through
   * the centers of the start/end texture pixels — a lightweight indicator
   * of the line's path, not a preview of every pixel it will stamp.
   */
  setPreviewLine(
    start: Vec2,
    end: Vec2
  ): void {
    const zoom = this.#viewport.zoom;
    const camera = this.#viewport.camera;
    const x1 = (start.x + 0.5) * zoom + camera.x;
    const y1 = (start.y + 0.5) * zoom + camera.y;
    const x2 = (end.x + 0.5) * zoom + camera.x;
    const y2 = (end.y + 0.5) * zoom + camera.y;

    for (const line of [this.#linePreviewOutline, this.#linePreviewInline]) {
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("visibility", "visible");
    }
  }

  clearPreviewLine(): void {
    this.#linePreviewOutline.setAttribute("visibility", "hidden");
    this.#linePreviewInline.setAttribute("visibility", "hidden");
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
