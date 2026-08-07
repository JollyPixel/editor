// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import { contrastingColor } from "../../utils/colors.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type { UVMap } from "../../uv/UVMap.ts";
import type {
  UVFace,
  UVRegion
} from "../../uv/UVRegion.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

// Constants
const kStrokeWidth = 2;
const kSelectedStrokeWidth = 3;
// Casing is this much wider than the main stroke.
const kCasingWidth = 2;
// Inset casing so it only shows inward.
const kCasingInset = kCasingWidth / 2;
const kDimOpacity = "0.45";
const kSelectedFillOpacity = "0.06";
const kLabelFontSize = 10;
const kLabelPadding = 3;
const kLabelCasingWidth = "3";
// Hide labels on tiny rects.
const kLabelMinScreenSize = 40;

/**
 * One rendered rect entry, with optional live-drag override applied.
 */
interface RenderEntry {
  key: string;
  region: UVRegion;
  face: UVFace | null;
  rect: SelectionRect;
  selected: boolean;
}

interface BorderStyle {
  color: string;
  strokeWidth: number;
  selected: boolean;
  dimmed: boolean;
}

function entryKey(
  id: string,
  face: UVFace | null
): string {
  return `${id}:${face ?? "*"}`;
}

function rectKey(
  rect: SelectionRect
): string {
  return `${rect.x},${rect.y},${rect.width},${rect.height}`;
}

/**
 * Border = colored stroke + inner contrasting casing for visibility.
 */
class Border {
  #group: SVGGElement;
  #casing: SVGRectElement;
  #stroke: SVGRectElement;

  constructor() {
    this.#group = document.createElementNS(SVG_NS, "g");
    this.#group.style.pointerEvents = "none";

    this.#casing = this.#group.appendChild(Border.#createRect());
    this.#stroke = this.#group.appendChild(Border.#createRect());
  }

  static #createRect(): SVGRectElement {
    const el = document.createElementNS(SVG_NS, "rect");

    el.style.fill = "none";
    el.setAttribute("vector-effect", "non-scaling-stroke");

    return el;
  }

  place(
    rect: SelectionRect,
    zoom: number,
    camera: Vec2
  ): void {
    const screen = {
      x: rect.x * zoom + camera.x,
      y: rect.y * zoom + camera.y,
      width: rect.width * zoom,
      height: rect.height * zoom
    };
    Border.#setGeometry(this.#stroke, screen);

    // Keep casing inside the rect; clamp prevents negative size on tiny rects.
    const inset = Math.min(kCasingInset, screen.width / 2, screen.height / 2);
    Border.#setGeometry(this.#casing, {
      x: screen.x + inset,
      y: screen.y + inset,
      width: screen.width - (2 * inset),
      height: screen.height - (2 * inset)
    });
  }

  static #setGeometry(
    el: SVGRectElement,
    geometry: SelectionRect
  ): void {
    for (const [name, value] of Object.entries(geometry)) {
      el.setAttribute(name, String(value));
    }
  }

  paint(
    style: BorderStyle
  ): void {
    this.#casing.setAttribute("stroke", contrastingColor(style.color));
    this.#casing.style.strokeWidth = String(style.strokeWidth + kCasingWidth);

    this.#stroke.setAttribute("stroke", style.color);
    this.#stroke.style.strokeWidth = String(style.strokeWidth);
    // Light fill marks the selected entry in stacked/similar rects.
    this.#stroke.style.fill = style.selected ? style.color : "none";
    this.#stroke.style.fillOpacity = style.selected ? kSelectedFillOpacity : "";

    this.#group.style.opacity = style.dimmed ? kDimOpacity : "";
  }

  /**
    * Re-append to keep this border on top of older ones.
   */
  appendTo(
    svg: SVGElement
  ): void {
    svg.appendChild(this.#group);
  }

  remove(): void {
    this.#group.remove();
  }
}

/**
 * Draws UV region overlays and updates on UVMap events.
 * Selected faces paint last; non-selected uncollapsed faces are dimmed.
 */
export class UVOverlay {
  #viewport: DefaultViewport;
  #uvMap: UVMap;
  #svg: SVGElement;
  #borders = new Map<string, Border>();
  #labels = new Map<string, SVGTextElement>();
  #liveOverride: { id: string; face: UVFace | null; rect: SelectionRect; } | null = null;

  #onRegionCreated = () => this.#render();
  #onRegionDeleted = () => this.#render();
  #onRegionMoved = () => this.#render();
  #onRegionStateChanged = () => this.#render();
  #onSelectionChanged = () => this.#render();
  #onVisibilityChanged = () => this.#render();

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    uvMap: UVMap
  ) {
    this.#svg = svg;
    this.#viewport = viewport;
    this.#uvMap = uvMap;

    this.#uvMap.on("region-created", this.#onRegionCreated);
    this.#uvMap.on("region-deleted", this.#onRegionDeleted);
    this.#uvMap.on("region-moved", this.#onRegionMoved);
    this.#uvMap.on("region-state-changed", this.#onRegionStateChanged);
    this.#uvMap.on("selection-changed", this.#onSelectionChanged);
    this.#uvMap.on("visibility-changed", this.#onVisibilityChanged);
  }

  /**
   * Sets a live drag override for one face (or null to clear).
   */
  setLiveOverride(
    id: string,
    face: UVFace | null,
    rect: SelectionRect | null
  ): void {
    this.#liveOverride = rect ? { id, face, rect } : null;
    this.#render();
  }

  /**
   * Re-renders the current viewport (pan/zoom).
   */
  refresh(): void {
    this.#render();
  }

  destroy(): void {
    this.#uvMap.off("region-created", this.#onRegionCreated);
    this.#uvMap.off("region-deleted", this.#onRegionDeleted);
    this.#uvMap.off("region-moved", this.#onRegionMoved);
    this.#uvMap.off("region-state-changed", this.#onRegionStateChanged);
    this.#uvMap.off("selection-changed", this.#onSelectionChanged);
    this.#uvMap.off("visibility-changed", this.#onVisibilityChanged);

    for (const border of this.#borders.values()) {
      border.remove();
    }
    this.#borders.clear();
    for (const label of this.#labels.values()) {
      label.remove();
    }
    this.#labels.clear();
  }

  #render(): void {
    const entries = this.#visibleEntries();
    const painted = this.#paintOrder(entries);

    this.#prune(this.#borders, painted);

    const zoom = this.#viewport.zoom.value;
    const camera = this.#viewport.camera;

    for (const entry of painted) {
      const border = this.#borders.get(entry.key) ?? this.#createBorder(entry.key);
      // Uncollapsed regions show emphasis (+stroke) only on selected faces.
      const uncollapsed = entry.region.state === "uncollapsed";

      border.place(entry.rect, zoom, camera);
      border.paint({
        color: entry.region.color,
        strokeWidth: uncollapsed && entry.selected ?
          kSelectedStrokeWidth :
          kStrokeWidth,
        selected: entry.selected,
        dimmed: uncollapsed && !entry.selected
      });
      border.appendTo(this.#svg);
    }

    this.#renderLabels(entries, zoom, camera);
  }

  /**
    * One label per coincident-rect stack.
    * Prefer selected face label; otherwise use top hit-order face.
   */
  #renderLabels(
    entries: RenderEntry[],
    zoom: number,
    camera: Vec2
  ): void {
    const groups = new Map<string, RenderEntry[]>();
    for (const entry of entries) {
      if (entry.face === null) {
        continue;
      }

      const key = `${entry.region.id}|${rectKey(entry.rect)}`;
      const group = groups.get(key);
      if (group) {
        group.push(entry);
      }
      else {
        groups.set(key, [entry]);
      }
    }

    const labelled: RenderEntry[] = [];
    for (const group of groups.values()) {
      // entries follows UV_FACES order; group[0] matches first hit target.
      const entry = group.find((candidate) => candidate.selected) ?? group[0];

      if (
        entry.rect.width * zoom < kLabelMinScreenSize ||
        entry.rect.height * zoom < kLabelMinScreenSize
      ) {
        continue;
      }

      labelled.push(entry);
    }

    this.#prune(this.#labels, labelled);

    for (const entry of labelled) {
      const el = this.#labels.get(entry.key) ?? this.#createLabel(entry.key);

      el.setAttribute("fill", entry.region.color);
      // Border-like text casing, drawn under glyphs via paint-order.
      el.setAttribute("stroke", contrastingColor(entry.region.color));
      el.setAttribute("x", String(entry.rect.x * zoom + camera.x + kLabelPadding));
      el.setAttribute(
        "y",
        String(entry.rect.y * zoom + camera.y + kLabelPadding + kLabelFontSize)
      );
      el.textContent = entry.face;

      // Append after rects so labels stay visible.
      this.#svg.appendChild(el);
    }
  }

  #visibleEntries(): RenderEntry[] {
    const selectedRegionId = this.#uvMap.selectedRegionId;
    const selectedFace = this.#uvMap.selectedFace;
    const entries: RenderEntry[] = [];

    for (const region of this.#uvMap.regions) {
      if (!this.#uvMap.isVisible(region.id)) {
        continue;
      }

      for (const { face, rect } of region.facesOf()) {
        const override = this.#liveOverride;
        const overridden = override !== null &&
          override.id === region.id &&
          override.face === face;

        entries.push({
          key: entryKey(region.id, face),
          region,
          face,
          rect: overridden ? override.rect : rect,
          selected: region.id === selectedRegionId && face === selectedFace
        });
      }
    }

    return entries;
  }

  /**
    * Paint selected entries last so they stay on top.
   */
  #paintOrder(
    entries: RenderEntry[]
  ): RenderEntry[] {
    const selected = entries.filter((entry) => entry.selected);
    if (selected.length === 0) {
      return entries;
    }

    return [
      ...entries.filter((entry) => !entry.selected),
      ...selected
    ];
  }

  #prune<T extends { remove(): void; }>(
    elements: Map<string, T>,
    keep: RenderEntry[]
  ): void {
    const keys = new Set(keep.map((entry) => entry.key));

    for (const [key, el] of elements) {
      if (!keys.has(key)) {
        el.remove();
        elements.delete(key);
      }
    }
  }

  #createBorder(
    key: string
  ): Border {
    const border = new Border();
    this.#borders.set(key, border);

    return border;
  }

  #createLabel(
    key: string
  ): SVGTextElement {
    const el = document.createElementNS(SVG_NS, "text");

    Object.assign(el.style, {
      pointerEvents: "none",
      fontSize: `${kLabelFontSize}px`,
      fontFamily: "system-ui, sans-serif",
      userSelect: "none"
    });
    el.setAttribute("paint-order", "stroke");
    el.setAttribute("stroke-width", kLabelCasingWidth);
    el.setAttribute("stroke-linejoin", "round");

    this.#svg.appendChild(el);
    this.#labels.set(key, el);

    return el;
  }
}
