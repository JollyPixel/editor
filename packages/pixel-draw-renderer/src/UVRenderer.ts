// Import Internal Dependencies
import type {
  DefaultViewport,
  Vec2,
  UVHandleType
} from "./types.ts";
import type {
  UVMap,
  UVMapChangedDetail
} from "./UVMap.ts";
import type { UVRegionData } from "./UVRegion.ts";

// CONSTANTS
const kSvgNs = "http://www.w3.org/2000/svg";
const kHandleRadius = 4;
const kHandleTypes: readonly UVHandleType[] = [
  "corner-tl",
  "corner-tr",
  "corner-bl",
  "corner-br",
  "edge-t",
  "edge-b",
  "edge-l",
  "edge-r"
];

export interface UVRendererOptions {
  /** The root SVG element from SvgManager.getSvgElement(). */
  svg: SVGElement;
  uvMap: UVMap;
  viewport: DefaultViewport;
  textureSize: Vec2;
}

/**
 * Renders UV regions as an SVG overlay on top of the canvas.
 * All elements use `pointer-events: none` — hit-testing is handled by UVInputHandler.
 */
export class UVRenderer {
  #svg: SVGElement;
  #uvMap: UVMap;
  #viewport: DefaultViewport;
  #textureSize: Vec2;
  #overlayGroup: SVGGElement;
  #previewGroup: SVGGElement;
  #regionGroups: Map<string, SVGGElement> = new Map();
  #onChanged: (event: Event) => void;
  #dragPreview: UVRegionData | null = null;

  constructor(
    options: UVRendererOptions
  ) {
    this.#svg = options.svg;
    this.#uvMap = options.uvMap;
    this.#viewport = options.viewport;
    this.#textureSize = options.textureSize;

    this.#overlayGroup = this.#createGroup("uv-overlay");
    this.#svg.appendChild(this.#overlayGroup);

    this.#previewGroup = this.#createGroup("uv-preview");
    this.#svg.appendChild(this.#previewGroup);

    // Seed from existing regions
    for (const region of this.#uvMap) {
      this.#addRegionGroup(region.toData());
    }
    this.#applyAttributes();

    this.#onChanged = (e: Event) => this.#handleChanged(e as CustomEvent<UVMapChangedDetail>);
    this.#uvMap.addEventListener("changed", this.#onChanged);
  }

  // ──────────────────────────── Public API ─────────────────────────────

  /** Recompute all SVG positions after a pan, zoom, or resize. */
  update(): void {
    this.#applyAttributes();
    if (this.#dragPreview) {
      this.#updatePreview();
    }
  }

  /** Convert normalized UV coordinates to canvas-space SVG pixel coordinates. */
  uvToSvg(u: number, v: number): Vec2 {
    const { zoom, camera } = this.#viewport;

    return {
      x: camera.x + u * this.#textureSize.x * zoom,
      y: camera.y + v * this.#textureSize.y * zoom
    };
  }

  /** Convert canvas-space SVG pixel coordinates to normalized UV. */
  svgToUV(
    cx: number,
    cy: number
  ): Vec2 {
    const { zoom, camera } = this.#viewport;
    const scaleX = this.#textureSize.x * zoom;
    const scaleY = this.#textureSize.y * zoom;

    return {
      x: scaleX === 0 ? 0 : (cx - camera.x) / scaleX,
      y: scaleY === 0 ? 0 : (cy - camera.y) / scaleY
    };
  }

  /**
   * Show a drag-preview rectangle while the user is drawing a new region.
   * Pass `null` to clear the preview.
   */
  setDragPreview(
    data: UVRegionData | null
  ): void {
    this.#dragPreview = data;
    this.#updatePreview();
  }

  destroy(): void {
    this.#uvMap.removeEventListener("changed", this.#onChanged);
    if (this.#overlayGroup.parentElement) {
      this.#overlayGroup.remove();
    }
    if (this.#previewGroup.parentElement) {
      this.#previewGroup.remove();
    }
    this.#regionGroups.clear();
  }

  // ──────────────────────────── Private ────────────────────────────────

  #handleChanged(
    event: CustomEvent<UVMapChangedDetail>
  ): void {
    const { type, regionId } = event.detail;

    switch (type) {
      case "add": {
        if (!regionId) {
          break;
        }
        const region = this.#uvMap.get(regionId);
        if (region) {
          this.#addRegionGroup(region.toData());
          this.#applyGroupAttributes(regionId);
        }
        break;
      }
      case "remove": {
        if (!regionId) {
          break;
        }
        const g = this.#regionGroups.get(regionId);
        if (g) {
          g.remove();
          this.#regionGroups.delete(regionId);
        }
        break;
      }
      case "select": {
        // Toggle handle visibility for old and new selected region
        for (const [id, g] of this.#regionGroups) {
          const isSelected = id === this.#uvMap.selectedId;
          this.#setHandlesVisible(g, isSelected);
        }
        break;
      }
      case "move":
      case "resize":
      case "label": {
        if (regionId) {
          this.#applyGroupAttributes(regionId);
        }
        break;
      }
    }
  }

  #addRegionGroup(
    data: UVRegionData
  ): void {
    const g = document.createElementNS(kSvgNs, "g") as SVGGElement;
    g.id = `uv-region-${data.id}`;
    g.style.pointerEvents = "none";

    // Fill rect
    const fill = document.createElementNS(kSvgNs, "rect");
    fill.classList.add("uv-fill");
    fill.setAttribute("fill-opacity", "0.25");
    fill.setAttribute("fill", data.color);
    fill.style.pointerEvents = "none";
    g.appendChild(fill);

    // Border rect
    const border = document.createElementNS(kSvgNs, "rect");
    border.classList.add("uv-border");
    border.setAttribute("fill", "none");
    border.setAttribute("stroke", data.color);
    border.setAttribute("stroke-width", "1");
    border.style.pointerEvents = "none";
    g.appendChild(border);

    // Label
    const label = document.createElementNS(kSvgNs, "text");
    label.classList.add("uv-label");
    label.setAttribute("font-size", "10");
    label.setAttribute("fill", data.color);
    label.style.pointerEvents = "none";
    label.style.userSelect = "none";
    label.textContent = data.label;
    g.appendChild(label);

    // Handles (hidden by default)
    for (const handleType of kHandleTypes) {
      const circle = document.createElementNS(kSvgNs, "circle");
      circle.classList.add("uv-handle", handleType);
      circle.setAttribute("r", String(kHandleRadius));
      circle.setAttribute("fill", data.color);
      circle.setAttribute("stroke", "#fff");
      circle.setAttribute("stroke-width", "1");
      circle.style.pointerEvents = "none";
      circle.style.visibility = "hidden";
      g.appendChild(circle);
    }

    this.#overlayGroup.appendChild(g);
    this.#regionGroups.set(data.id, g);
  }

  #applyAttributes(): void {
    for (const id of this.#regionGroups.keys()) {
      this.#applyGroupAttributes(id);
    }
  }

  #applyGroupAttributes(
    id: string
  ): void {
    const region = this.#uvMap.get(id);
    const g = this.#regionGroups.get(id);
    if (!region || !g) {
      return;
    }

    const { x: sx, y: sy } = this.uvToSvg(region.u, region.v);
    const { zoom } = this.#viewport;
    const sw = region.width * this.#textureSize.x * zoom;
    const sh = region.height * this.#textureSize.y * zoom;

    const fill = g.querySelector(".uv-fill") as SVGRectElement | null;
    if (fill) {
      fill.setAttribute("x", String(sx));
      fill.setAttribute("y", String(sy));
      fill.setAttribute("width", String(sw));
      fill.setAttribute("height", String(sh));
      fill.setAttribute("fill", region.color);
    }

    const border = g.querySelector(".uv-border") as SVGRectElement | null;
    if (border) {
      border.setAttribute("x", String(sx));
      border.setAttribute("y", String(sy));
      border.setAttribute("width", String(sw));
      border.setAttribute("height", String(sh));
      border.setAttribute("stroke", region.color);
    }

    const label = g.querySelector(".uv-label") as SVGTextElement | null;
    if (label) {
      label.setAttribute("x", String(sx + 2));
      label.setAttribute("y", String(sy + 12));
      label.setAttribute("fill", region.color);
      label.textContent = region.label;
    }

    const handlePositions = this.#getHandlePositions(region.u, region.v, {
      width: region.width,
      height: region.height
    });
    const circles = g.querySelectorAll<SVGCircleElement>(".uv-handle");
    circles.forEach((circle, index) => {
      const ht = kHandleTypes[index];
      if (!ht) {
        return;
      }
      const pos = handlePositions[ht];
      if (pos) {
        circle.setAttribute("cx", String(pos.x));
        circle.setAttribute("cy", String(pos.y));
        circle.setAttribute("fill", region.color);
      }
    });

    const isSelected = this.#uvMap.selectedId === id;
    this.#setHandlesVisible(g, isSelected);
  }

  #getHandlePositions(
    u: number,
    v: number,
    options: { width: number; height: number; }
  ): Record<UVHandleType, Vec2> {
    const { width, height } = options;

    const tl = this.uvToSvg(u, v);
    const tr = this.uvToSvg(u + width, v);
    const bl = this.uvToSvg(u, v + height);
    const br = this.uvToSvg(u + width, v + height);
    const tc = this.uvToSvg(u + width / 2, v);
    const bc = this.uvToSvg(u + width / 2, v + height);
    const ml = this.uvToSvg(u, v + height / 2);
    const mr = this.uvToSvg(u + width, v + height / 2);

    return {
      "corner-tl": tl,
      "corner-tr": tr,
      "corner-bl": bl,
      "corner-br": br,
      "edge-t": tc,
      "edge-b": bc,
      "edge-l": ml,
      "edge-r": mr,
      body: this.uvToSvg(u + width / 2, v + height / 2)
    };
  }

  #setHandlesVisible(
    svgElement: SVGGElement,
    visible: boolean
  ): void {
    const circles = svgElement.querySelectorAll<SVGCircleElement>(".uv-handle");
    circles.forEach((circle) => {
      circle.style.visibility = visible ? "visible" : "hidden";
    });
  }

  #updatePreview(): void {
    // Remove existing preview children
    while (this.#previewGroup.firstChild) {
      this.#previewGroup.removeChild(this.#previewGroup.firstChild);
    }

    if (!this.#dragPreview) {
      return;
    }
    const data = this.#dragPreview;
    const { x: sx, y: sy } = this.uvToSvg(data.u, data.v);
    const { zoom } = this.#viewport;
    const sw = data.width * this.#textureSize.x * zoom;
    const sh = data.height * this.#textureSize.y * zoom;

    const rect = document.createElementNS(kSvgNs, "rect");
    rect.setAttribute("x", String(sx));
    rect.setAttribute("y", String(sy));
    rect.setAttribute("width", String(sw));
    rect.setAttribute("height", String(sh));
    rect.setAttribute("fill", data.color);
    rect.setAttribute("fill-opacity", "0.15");
    rect.setAttribute("stroke", data.color);
    rect.setAttribute("stroke-width", "1");
    rect.setAttribute("stroke-dasharray", "4 2");
    rect.style.pointerEvents = "none";
    this.#previewGroup.appendChild(rect);
  }

  #createGroup(
    id: string
  ): SVGGElement {
    const svgElement = document.createElementNS(kSvgNs, "g") as SVGGElement;
    svgElement.id = id;
    svgElement.style.pointerEvents = "none";

    return svgElement;
  }
}
