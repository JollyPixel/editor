// Import Third-party Dependencies
import { contrastingColor } from "@jolly-pixel/color";

// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import {
  geometryKey,
  rectOf,
  triangleCornerOf
} from "../../uv/geometry/geometry.ts";
import type { UVOverlayEntry } from "./UVOverlayProjection.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
import type {
  UVRegion,
  UVTriangleCorner
} from "../../uv/region/UVRegion.ts";

// CONSTANTS
const kFontSize = 10;
const kPadding = 3;
const kCasingWidth = "3";
const kMinScreenSize = 40;
const kMaxLength = 20;
const kAnchors: Record<UVTriangleCorner | "none", { right: boolean; bottom: boolean; }> = {
  none: { right: false, bottom: false },
  "top-left": { right: false, bottom: false },
  "top-right": { right: true, bottom: false },
  "bottom-left": { right: false, bottom: true },
  "bottom-right": { right: true, bottom: true }
};

interface UVLabel {
  entry: UVOverlayEntry;
  stacked: number;
}

export class UVRegionLabels {
  #group: SVGGElement;
  #viewport: DefaultViewport;
  #uvMap: UVMap;
  #labels = new Map<string, SVGTextElement>();

  constructor(
    group: SVGGElement,
    viewport: DefaultViewport,
    uvMap: UVMap
  ) {
    this.#group = group;
    this.#viewport = viewport;
    this.#uvMap = uvMap;
  }

  render(
    entries: readonly UVOverlayEntry[]
  ): void {
    const labels = this.#labelsOf(entries);
    const keys = new Set(labels.map(({ entry }) => entry.key));
    for (const [key, el] of this.#labels) {
      if (!keys.has(key)) {
        el.remove();
        this.#labels.delete(key);
      }
    }

    for (const label of labels) {
      this.#place(label);
    }
  }

  destroy(): void {
    for (const el of this.#labels.values()) {
      el.remove();
    }
    this.#labels.clear();
  }

  #labelsOf(
    entries: readonly UVOverlayEntry[]
  ): UVLabel[] {
    const showRegionLabels = this.#uvMap.showRegionLabels;
    const selectedOnly = this.#uvMap.labelScope === "selected";
    const groups = new Map<string, UVOverlayEntry[]>();
    for (const entry of entries) {
      if (selectedOnly && entry.region.id !== this.#uvMap.selectedRegionId) {
        continue;
      }
      if (entry.slot === null && !showRegionLabels) {
        continue;
      }

      const key = entry.slot === null ?
        entry.key :
        `${entry.region.id}|${geometryKey(entry.geometry)}`;
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }

    const zoom = this.#viewport.zoom.value;
    const labels: UVLabel[] = [];
    for (const group of groups.values()) {
      const entry = group.find((candidate) => candidate.selected) ?? group[0];
      const rect = rectOf(entry.geometry);
      if (rect.width * zoom >= kMinScreenSize && rect.height * zoom >= kMinScreenSize) {
        labels.push({ entry, stacked: group.length });
      }
    }

    return labels;
  }

  #place(
    label: UVLabel
  ): void {
    const { entry } = label;
    const el = this.#labels.get(entry.key) ?? this.#create(entry.key);
    const screen = this.#viewport.toScreenRect(rectOf(entry.geometry));
    const anchor = kAnchors[triangleCornerOf(entry.geometry) ?? "none"];
    const x = anchor.right ? screen.x + screen.width - kPadding : screen.x + kPadding;
    const y = anchor.bottom ?
      screen.y + screen.height - kPadding :
      screen.y + kPadding + kFontSize;

    el.setAttribute("fill", entry.region.color);
    el.setAttribute("stroke", contrastingColor(entry.region.color));
    el.setAttribute("x", String(x));
    el.setAttribute("y", String(y));
    el.setAttribute("text-anchor", anchor.right ? "end" : "start");

    if (!this.#uvMap.showRegionLabels) {
      el.textContent = UVRegionLabels.#slotText(label);
    }
    else if (entry.slot === null) {
      el.textContent = UVRegionLabels.#regionText(entry.region);
    }
    else {
      const firstY = anchor.bottom ? y - kFontSize : y;
      el.replaceChildren(
        UVRegionLabels.#line(x, firstY, UVRegionLabels.#regionText(entry.region)),
        UVRegionLabels.#line(x, firstY + kFontSize, UVRegionLabels.#slotText(label))
      );
    }

    this.#group.appendChild(el);
  }

  #create(
    key: string
  ): SVGTextElement {
    const el = document.createElementNS(SVG_NS, "text");
    Object.assign(el.style, {
      pointerEvents: "none",
      fontSize: `${kFontSize}px`,
      fontFamily: "system-ui, sans-serif",
      userSelect: "none"
    });
    el.setAttribute("paint-order", "stroke");
    el.setAttribute("stroke-width", kCasingWidth);
    el.setAttribute("stroke-linejoin", "round");
    this.#labels.set(key, el);

    return el;
  }

  static #line(
    x: number,
    y: number,
    text: string
  ): SVGTSpanElement {
    const line = document.createElementNS(SVG_NS, "tspan");
    line.setAttribute("x", String(x));
    line.setAttribute("y", String(y));
    line.textContent = text;

    return line;
  }

  static #slotText(
    label: UVLabel
  ): string {
    const hidden = label.stacked - 1;
    const slot = label.entry.slot ?? "";

    return hidden > 0 ? `${slot} +${hidden}` : slot;
  }

  static #regionText(
    region: UVRegion
  ): string {
    const characters = [...(region.name?.trim() || region.id)];
    const value = characters.length <= kMaxLength ?
      characters.join("") :
      `${characters.slice(0, kMaxLength - 1).join("")}…`;

    return `(${value})`;
  }
}
