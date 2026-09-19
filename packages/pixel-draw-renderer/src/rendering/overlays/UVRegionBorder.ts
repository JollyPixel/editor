// Import Third-party Dependencies
import { contrastingColor } from "@jolly-pixel/color";

// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import {
  rectOf,
  rotationOf
} from "../../uv/geometry.ts";
import { compoundOutline } from "../../uv/compoundOutline.ts";
import type {
  UVCompound,
  UVCompoundPart,
  UVGeometry,
  UVQuarterTurn,
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
const kOutlineCacheLimit = 64;
const kOutlineCache = new Map<string, Vec2[][] | null>();
const kMarkerSize = 5;

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
  #marker: SVGPolygonElement;
  #elementName: string;

  constructor(
    geometry: UVGeometry
  ) {
    this.#group = document.createElementNS(SVG_NS, "g");
    this.#group.style.pointerEvents = "none";
    this.#elementName = elementNameOf(geometry);
    this.#casing = UVRegionBorder.#createElement(geometry);
    this.#stroke = UVRegionBorder.#createElement(geometry);
    this.#marker = document.createElementNS(SVG_NS, "polygon");
    this.#marker.setAttribute("part", "uv-orientation-marker");
    this.#group.append(
      this.#casing,
      this.#stroke
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
    this.#ensureGeometryElements(geometry);
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
    this.#placeMarker(rotationOf(geometry), screen);
  }

  #placeMarker(
    rotation: UVQuarterTurn,
    screen: SelectionRect
  ): void {
    if (rotation === 0) {
      this.#marker.remove();

      return;
    }

    this.#group.appendChild(this.#marker);

    this.#marker.setAttribute(
      "points",
      markerPoints(rotation, screen)
        .map((point) => `${point.x},${point.y}`)
        .join(" ")
    );
  }

  #ensureGeometryElements(
    geometry: UVGeometry
  ): void {
    const elementName = elementNameOf(geometry);
    if (this.#elementName === elementName) {
      return;
    }

    this.#elementName = elementName;
    this.#casing = UVRegionBorder.#createElement(geometry);
    this.#stroke = UVRegionBorder.#createElement(geometry);
    this.#group.replaceChildren(
      this.#casing,
      this.#stroke
    );
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
    this.#marker.style.fill = style.color;
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

function markerPoints(
  rotation: UVQuarterTurn,
  screen: SelectionRect
): Vec2[] {
  const size = Math.min(kMarkerSize, screen.width / 3, screen.height / 3);
  const left = screen.x;
  const top = screen.y;
  const right = screen.x + screen.width;
  const bottom = screen.y + screen.height;
  const centerX = screen.x + (screen.width / 2);
  const centerY = screen.y + (screen.height / 2);

  switch (rotation) {
    case 1:
      return [
        { x: right, y: centerY - size },
        { x: right, y: centerY + size },
        { x: right - size, y: centerY }
      ];
    case 2:
      return [
        { x: centerX - size, y: bottom },
        { x: centerX + size, y: bottom },
        { x: centerX, y: bottom - size }
      ];
    case 3:
      return [
        { x: left, y: centerY - size },
        { x: left, y: centerY + size },
        { x: left + size, y: centerY }
      ];
    default:
      return [
        { x: centerX - size, y: top },
        { x: centerX + size, y: top },
        { x: centerX, y: top + size }
      ];
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
