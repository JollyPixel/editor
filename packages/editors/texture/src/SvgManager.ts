/* eslint-disable @stylistic/no-mixed-operators */

// Import Internal Dependencies
import CanvasManager from "./CanvasManager.js";

// CONSTANTS
const kSvgNs = "http://www.w3.org/2000/svg";

export interface SvgManagerOptions {
  color?: string;
  selectedColor?: string;
  pixelSnapping?: boolean;
  ratioPixelPerUnit?: number;
}

export default class SvgManager {
  private parentHtmlElement: HTMLDivElement;
  private canvasManager: CanvasManager;
  private svg: SVGElement;

  private ratioPixelPerUnit: number;

  private UvColor: string;

  // public

  private highlightElements: SVGGElement;
  // private UVs: number[][];

  constructor(canvasManager: CanvasManager, options: SvgManagerOptions = {}) {
    this.canvasManager = canvasManager;
    this.parentHtmlElement = this.canvasManager.getParentHtmlElement();
    this.svg = this.initSvgElement();

    this.ratioPixelPerUnit = options.ratioPixelPerUnit || 16;

    this.UvColor = options.color || "red";

    this.highlightElements = this.initBrushHighlight();
  }

  private initSvgElement() {
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

    const boundingRect = this.parentHtmlElement.getBoundingClientRect();
    svg.setAttribute("width", String(boundingRect.width));
    svg.setAttribute("height", String(boundingRect.height));

    this.parentHtmlElement.appendChild(svg);

    return svg;
  }

  private initBrushHighlight(): SVGGElement {
    const highlightGroupElement = document.createElementNS(kSvgNs, "g");

    const defaultStyle = {
      pointerEvents: "none",
      strokeWidth: 2
    };

    const highlightElementInLine = document.createElementNS(kSvgNs, "rect");
    Object.assign(highlightElementInLine.style, defaultStyle);
    highlightElementInLine.setAttribute("stroke", this.canvasManager.brush.getColorInline());
    highlightElementInLine.setAttribute("fill", "none");
    highlightElementInLine.setAttribute("x", "0.01");
    highlightElementInLine.setAttribute("y", "0.01");
    highlightElementInLine.setAttribute("width", "0.98");
    highlightElementInLine.setAttribute("height", "0.98");
    highlightElementInLine.setAttribute("vector-effect", "non-scaling-stroke");
    highlightGroupElement.appendChild(highlightElementInLine);

    const highlightElementOutLine = document.createElementNS(kSvgNs, "rect");
    Object.assign(highlightElementOutLine.style, defaultStyle);
    highlightElementOutLine.setAttribute("stroke", this.canvasManager.brush.getColorOutline());
    highlightElementOutLine.setAttribute("fill", "none");
    highlightElementOutLine.setAttribute("width", "1");
    highlightElementOutLine.setAttribute("height", "1");
    highlightElementOutLine.setAttribute("vector-effect", "non-scaling-stroke");
    highlightGroupElement.appendChild(highlightElementOutLine);

    this.svg.appendChild(highlightGroupElement);

    return highlightGroupElement;
  }

  updateBrushHighlight(x: number | null, y: number | null) {
    // Si x ou y est null, masquer le highlight
    if (x === null || y === null) {
      this.hideSvgHighlight();

      return;
    }

    const zoom = this.canvasManager.getZoom();
    const camera = this.canvasManager.getCamera();
    const brushSize = this.canvasManager.brush.getSize();
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
    this.highlightElements.setAttribute("transform", `${translate} scale(${highlightBrushSize})`);
    this.highlightElements.setAttribute("visibility", "visible");
  }

  hideSvgHighlight() {
    this.highlightElements.setAttribute("visibility", "hidden");
  }

  updateSvgSize(width: number, height: number) {
    this.svg.setAttribute("width", String(width));
    this.svg.setAttribute("height", String(height));
  }

  public reparentSvgTo(newParentElement: HTMLDivElement): void {
    if (!this.svg) {
      return;
    }

    if (this.svg.parentElement) {
      this.svg.remove();
    }

    newParentElement.appendChild(this.svg);
    this.parentHtmlElement = newParentElement;
  }

  drawUVs(UVs: number[]) {
    const textureSize = this.canvasManager.getTextureSize();
    const pixelUvValue = { x: 1 / textureSize.x, y: 1 / textureSize.y };
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
    }
  }

  // createRect() {

  // }
}
