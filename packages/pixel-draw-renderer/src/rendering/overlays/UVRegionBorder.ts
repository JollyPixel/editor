// Import Third-party Dependencies
import { contrastingColor } from "@jolly-pixel/color";

// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import { rectOf } from "../../uv/geometry.ts";
import { compoundOutline } from "../../uv/compoundOutline.ts";
import type {
  UVCompound,
  UVCompoundPart,
  UVGeometry,
  UVTriangleCorner
} from "../../uv/UVRegion.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

// CONSTANTS
const kCasingWidth = 2;
const kCasingInset = kCasingWidth / 2;
const kDimOpacity = "0.45";
const kDashArray = "6 4";
const kSelectedFillOpacity = "0.06";
// Outlines are rebuilt on every pan and zoom, while a compound's parts almost
// never change; entries beyond this many are evicted oldest first.
const kOutlineCacheLimit = 64;
const kOutlineCache = new Map<string, Vec2[][] | null>();

export interface UVRegionBorderStyle {
  color: string;
  strokeWidth: number;
  selected: boolean;
  dimmed: boolean;
  dashed?: boolean;
  casing?: boolean;
}

export class UVRegionBorder {
  #group: SVGGElement;
  #casing: SVGGeometryElement;
  #stroke: SVGGeometryElement;

  constructor(
    geometry: UVGeometry
  ) {
    this.#group = document.createElementNS(SVG_NS, "g");
    this.#group.style.pointerEvents = "none";

    this.#casing = this.#group.appendChild(
      UVRegionBorder.#createElement(geometry)
    );
    this.#stroke = this.#group.appendChild(
      UVRegionBorder.#createElement(geometry)
    );
  }

  static #createElement(
    geometry: UVGeometry
  ): SVGGeometryElement {
    const el = document.createElementNS(
      SVG_NS,
      elementNameOf(geometry)
    ) as SVGGeometryElement;

    el.style.fill = "none";
    el.setAttribute("vector-effect", "non-scaling-stroke");

    return el;
  }

  place(
    geometry: UVGeometry,
    zoom: number,
    camera: Vec2
  ): void {
    const rect = rectOf(geometry);
    const screen = {
      x: rect.x * zoom + camera.x,
      y: rect.y * zoom + camera.y,
      width: rect.width * zoom,
      height: rect.height * zoom
    };
    UVRegionBorder.#placeGeometry(this.#stroke, geometry, screen);

    const inset = Math.min(
      kCasingInset,
      screen.width / 2,
      screen.height / 2
    );
    UVRegionBorder.#placeGeometry(this.#casing, geometry, {
      x: screen.x + inset,
      y: screen.y + inset,
      width: screen.width - (2 * inset),
      height: screen.height - (2 * inset)
    });
  }

  static #placeGeometry(
    el: SVGGeometryElement,
    uvGeometry: UVGeometry,
    screen: SelectionRect
  ): void {
    if ("shape" in uvGeometry && uvGeometry.shape === "compound") {
      el.setAttribute("d", compoundPath(uvGeometry, screen));

      return;
    }

    if ("shape" in uvGeometry) {
      const corners = {
        "top-left": [
          [screen.x, screen.y],
          [screen.x + screen.width, screen.y],
          [screen.x, screen.y + screen.height]
        ],
        "top-right": [
          [screen.x, screen.y],
          [screen.x + screen.width, screen.y],
          [screen.x + screen.width, screen.y + screen.height]
        ],
        "bottom-left": [
          [screen.x, screen.y],
          [screen.x, screen.y + screen.height],
          [screen.x + screen.width, screen.y + screen.height]
        ],
        "bottom-right": [
          [screen.x + screen.width, screen.y],
          [screen.x, screen.y + screen.height],
          [screen.x + screen.width, screen.y + screen.height]
        ]
      }[uvGeometry.corner];
      el.setAttribute(
        "points",
        corners.map((point) => point.join(",")).join(" ")
      );

      return;
    }

    for (const [name, value] of Object.entries(screen)) {
      el.setAttribute(name, String(value));
    }
  }

  paint(
    style: UVRegionBorderStyle
  ): void {
    const showCasing = style.casing ?? true;
    this.#casing.style.display = showCasing ? "" : "none";
    if (showCasing) {
      this.#casing.setAttribute("stroke", contrastingColor(style.color));
      this.#casing.style.strokeWidth = String(
        style.strokeWidth + kCasingWidth
      );
    }

    this.#stroke.setAttribute("stroke", style.color);
    this.#stroke.style.strokeWidth = String(style.strokeWidth);
    this.#stroke.style.fill = style.selected ? style.color : "none";
    this.#stroke.style.fillOpacity = style.selected ?
      kSelectedFillOpacity :
      "";
    this.#group.style.opacity = style.dimmed ? kDimOpacity : "";

    if (style.dashed) {
      this.#stroke.setAttribute("stroke-dasharray", kDashArray);
      this.#casing.setAttribute("stroke-dasharray", kDashArray);
    }
    else {
      this.#stroke.removeAttribute("stroke-dasharray");
      this.#casing.removeAttribute("stroke-dasharray");
    }
  }

  appendTo(
    svg: SVGElement
  ): void {
    svg.appendChild(this.#group);
  }

  remove(): void {
    this.#group.remove();
  }
}

function elementNameOf(
  geometry: UVGeometry
): string {
  if (!("shape" in geometry)) {
    return "rect";
  }

  return geometry.shape === "compound" ? "path" : "polygon";
}

/**
 * Outlines the union of the parts, so an assembly such as the L of a stair
 * reads as one continuous shape instead of stacked rectangles. Falls back to
 * one subpath per part when the parts do not stitch into closed loops.
 */
function compoundPath(
  geometry: UVCompound,
  screen: SelectionRect
): string {
  const loops = outlineOf(geometry.parts);
  if (loops === null) {
    return partsPath(geometry, screen);
  }

  return loops
    .map((loop) => {
      const points = loop.map((point) => {
        const x = screen.x + (point.x * screen.width);
        const y = screen.y + (point.y * screen.height);

        return `${x},${y}`;
      });

      return `M${points.join("L")}Z`;
    })
    .join(" ");
}

function outlineOf(
  parts: readonly UVCompoundPart[]
): Vec2[][] | null {
  const key = JSON.stringify(parts);
  const cached = kOutlineCache.get(key);
  if (typeof cached !== "undefined") {
    return cached;
  }

  const loops = compoundOutline(parts);
  if (kOutlineCache.size >= kOutlineCacheLimit) {
    const [oldest] = kOutlineCache.keys();
    kOutlineCache.delete(oldest);
  }
  kOutlineCache.set(key, loops);

  return loops;
}

function partsPath(
  geometry: UVCompound,
  screen: SelectionRect
): string {
  function scale(
    part: SelectionRect
  ): SelectionRect {
    return {
      x: screen.x + (part.x * screen.width),
      y: screen.y + (part.y * screen.height),
      width: part.width * screen.width,
      height: part.height * screen.height
    };
  }

  return geometry.parts.map((part) => {
    const rect = scale("shape" in part ? part.rect : part);
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;

    if (!("shape" in part)) {
      return `M${rect.x},${rect.y}H${right}V${bottom}H${rect.x}Z`;
    }

    const corners: Record<UVTriangleCorner, string> = {
      "top-left": `M${rect.x},${rect.y}H${right}L${rect.x},${bottom}Z`,
      "top-right": `M${rect.x},${rect.y}H${right}V${bottom}Z`,
      "bottom-left": `M${rect.x},${rect.y}V${bottom}H${right}Z`,
      "bottom-right": `M${right},${rect.y}V${bottom}H${rect.x}Z`
    };

    return corners[part.corner];
  }).join(" ");
}
