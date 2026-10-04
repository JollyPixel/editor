// Import Third-party Dependencies
import { contrastingColor } from "@jolly-pixel/color";

// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import {
  outlinePoints,
  rectOf,
  rotationOf,
  triangleCornerOf
} from "../../uv/geometry/geometry.ts";
import { compoundOutline } from "../../uv/geometry/compoundOutline.ts";
import type {
  UVCompound,
  UVCompoundPart,
  UVGeometry,
  UVQuarterTurn
} from "../../uv/region/UVRegion.ts";
import type { ScreenProjection } from "../Viewport.ts";
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
  #casing: SVGPathElement;
  #stroke: SVGPathElement;
  #marker: SVGPolygonElement;

  constructor() {
    this.#group = document.createElementNS(SVG_NS, "g");
    this.#group.style.pointerEvents = "none";
    this.#casing = UVRegionBorder.#createPath();
    this.#stroke = UVRegionBorder.#createPath();
    this.#marker = document.createElementNS(SVG_NS, "polygon");
    this.#marker.setAttribute("part", "uv-orientation-marker");
    this.#group.append(
      this.#casing,
      this.#stroke
    );
  }

  place(
    geometry: UVGeometry,
    view: ScreenProjection
  ): void {
    const screen = view.toScreenRect(rectOf(geometry));
    this.#stroke.setAttribute("d", geometryPath(geometry, screen));

    const inset = Math.min(
      kCasingInset,
      screen.width / 2,
      screen.height / 2
    );
    this.#casing.setAttribute("d", geometryPath(geometry, {
      x: screen.x + inset,
      y: screen.y + inset,
      width: screen.width - (2 * inset),
      height: screen.height - (2 * inset)
    }));
    this.#placeMarker(rotationOf(geometry), screen);
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

    for (const path of [this.#stroke, this.#casing]) {
      if (style.dashed) {
        path.setAttribute("stroke-dasharray", kDashArray);
      }
      else {
        path.removeAttribute("stroke-dasharray");
      }
    }
  }

  appendTo(
    parent: SVGElement
  ): void {
    parent.appendChild(this.#group);
  }

  remove(): void {
    this.#group.remove();
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

  static #createPath(): SVGPathElement {
    const path = document.createElementNS(SVG_NS, "path");
    path.style.fill = "none";
    path.setAttribute("vector-effect", "non-scaling-stroke");

    return path;
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

function geometryPath(
  geometry: UVGeometry,
  screen: SelectionRect
): string {
  if ("shape" in geometry && geometry.shape === "compound") {
    return compoundPath(geometry, screen);
  }

  return pathOf(outlinePoints(screen, triangleCornerOf(geometry)));
}

function pathOf(
  points: readonly Vec2[]
): string {
  return `M${points.map((point) => `${point.x},${point.y}`).join("L")}Z`;
}

function compoundPath(
  geometry: UVCompound,
  screen: SelectionRect
): string {
  function scaled(
    point: Vec2
  ): Vec2 {
    return {
      x: screen.x + (point.x * screen.width),
      y: screen.y + (point.y * screen.height)
    };
  }

  const loops = outlineOf(geometry.parts) ?? [];

  return loops.map((loop) => pathOf(loop.map(scaled))).join(" ");
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
