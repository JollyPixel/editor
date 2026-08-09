// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import { contrastingColor } from "../../utils/colors.ts";
import { rectOf } from "../../uv/geometry.ts";
import type { UVGeometry } from "../../uv/UVRegion.ts";
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
      "shape" in geometry ? "polygon" : "rect"
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
