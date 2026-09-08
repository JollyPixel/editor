// Import Third-party Dependencies
import { contrastingColor } from "@jolly-pixel/color";

// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import {
  geometryAt,
  geometryKey,
  rectOf,
  triangleCornerOf
} from "../../uv/geometry.ts";
import { UVRegionBorder } from "./UVRegionBorder.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type { UVMap } from "../../uv/UVMap.ts";
import type {
  UVSlot,
  UVGeometry,
  UVRegion
} from "../../uv/UVRegion.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

// CONSTANTS
const kStrokeWidth = 2;
const kSelectedStrokeWidth = 3;
const kLabelFontSize = 10;
const kLabelPadding = 3;
const kLabelCasingWidth = "3";
// Hide labels on tiny rects.
const kLabelMinScreenSize = 40;
const kLabelMaxLength = 20;

interface RenderEntry {
  key: string;
  region: UVRegion;
  face: UVSlot | null;
  geometry: UVGeometry;
  selected: boolean;
  /**
   * Faces sharing this entry's outline, so a stack of slots stays visible.
   */
  stacked?: number;
}

function deltaOf(
  from: SelectionRect,
  to: SelectionRect
): Vec2 {
  return {
    x: to.x - from.x,
    y: to.y - from.y
  };
}

function entryKey(
  id: string,
  face: UVSlot | null
): string {
  return `${id}:${face ?? "*"}`;
}

function faceLabel(
  entry: RenderEntry
): string {
  const hidden = (entry.stacked ?? 1) - 1;

  return hidden > 0 ? `${entry.face} +${hidden}` : entry.face ?? "";
}

function truncateLabel(
  value: string
): string {
  const characters = [...value];
  if (characters.length <= kLabelMaxLength) {
    return value;
  }

  return `${characters.slice(0, kLabelMaxLength - 1).join("")}…`;
}

function regionLabel(
  region: UVRegion
): string {
  const name = region.name?.trim();
  const value = name || region.id;

  return `(${truncateLabel(value)})`;
}

/**
 * Paints selected faces last and dims other free faces.
 */
export class UVRegionLayer {
  #viewport: DefaultViewport;
  #uvMap: UVMap;
  #group: SVGGElement;
  #borders = new Map<string, UVRegionBorder>();
  #labels = new Map<string, SVGTextElement>();
  #liveOverride: { id: string; face: UVSlot | null; rect: SelectionRect; } | null = null;
  #ghostSuppressed = new Set<string>();

  #onRegionCreated = () => this.#render();
  #onRegionDeleted = () => this.#render();
  #onRegionMoved = () => this.#render();
  #onRegionStateChanged = () => this.#render();
  #onSelectionChanged = () => this.#render();
  #onVisibilityChanged = () => this.#render();
  #onLabelVisibilityChanged = () => this.#render();

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    uvMap: UVMap
  ) {
    this.#group = this.#init(svg);
    this.#viewport = viewport;
    this.#uvMap = uvMap;

    this.#uvMap.on("region-created", this.#onRegionCreated);
    this.#uvMap.on("region-deleted", this.#onRegionDeleted);
    this.#uvMap.on("region-moved", this.#onRegionMoved);
    this.#uvMap.on("region-state-changed", this.#onRegionStateChanged);
    this.#uvMap.on("selection-changed", this.#onSelectionChanged);
    this.#uvMap.on("visibility-changed", this.#onVisibilityChanged);
    this.#uvMap.on("label-visibility-changed", this.#onLabelVisibilityChanged);
  }

  setLiveOverride(
    id: string,
    face: UVSlot | null,
    rect: SelectionRect | null
  ): void {
    this.#liveOverride = rect ? { id, face, rect } : null;
    this.#render();
  }

  refresh(): void {
    this.#render();
  }

  /**
   * Suppresses stale region borders beneath peer drag ghosts.
   */
  setGhostSuppressed(
    entries: Iterable<{ id: string; face: UVSlot | null; }>
  ): void {
    this.#ghostSuppressed = new Set(
      [...entries].map(({ id, face }) => entryKey(id, face))
    );
    this.#render();
  }

  destroy(): void {
    this.#uvMap.off("region-created", this.#onRegionCreated);
    this.#uvMap.off("region-deleted", this.#onRegionDeleted);
    this.#uvMap.off("region-moved", this.#onRegionMoved);
    this.#uvMap.off("region-state-changed", this.#onRegionStateChanged);
    this.#uvMap.off("selection-changed", this.#onSelectionChanged);
    this.#uvMap.off("visibility-changed", this.#onVisibilityChanged);
    this.#uvMap.off("label-visibility-changed", this.#onLabelVisibilityChanged);

    for (const border of this.#borders.values()) {
      border.remove();
    }
    this.#borders.clear();
    for (const label of this.#labels.values()) {
      label.remove();
    }
    this.#labels.clear();
    this.#group.remove();
  }

  #render(): void {
    const entries = this.#visibleEntries();
    const painted = this.#paintOrder(entries);

    this.#prune(this.#borders, painted);

    const zoom = this.#viewport.zoom.value;
    const camera = this.#viewport.camera;

    for (const entry of painted) {
      const border = this.#borders.get(entry.key) ?? this.#createBorder(entry.key, entry.geometry);
      const perFace = entry.region.state === "free";
      const emphasised = entry.selected && entry.region.state !== "stacked";

      border.place(entry.geometry, zoom, camera);
      border.paint({
        color: entry.region.color,
        strokeWidth: emphasised ?
          kSelectedStrokeWidth :
          kStrokeWidth,
        selected: entry.selected,
        dimmed: perFace && !entry.selected
      });
      border.appendTo(this.#group);
    }

    this.#renderLabels(entries, zoom, camera);
  }

  /**
   * Uses one label per stack, preferring the selected or top hit-order face.
   */
  #renderLabels(
    entries: RenderEntry[],
    zoom: number,
    camera: Vec2
  ): void {
    const showRegionLabels = this.#uvMap.showAll || this.#uvMap.showRegionLabels;
    const groups = new Map<string, RenderEntry[]>();
    for (const entry of entries) {
      if (entry.face === null) {
        if (showRegionLabels) {
          groups.set(entry.key, [entry]);
        }
        continue;
      }

      const key = `${entry.region.id}|${geometryKey(entry.geometry)}`;
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
      // Entries follow the region face order; group[0] is the first hit target.
      const entry = group.find((candidate) => candidate.selected) ?? group[0];

      if (
        rectOf(entry.geometry).width * zoom < kLabelMinScreenSize ||
        rectOf(entry.geometry).height * zoom < kLabelMinScreenSize
      ) {
        continue;
      }

      labelled.push({
        ...entry,
        stacked: group.length
      });
    }

    this.#prune(this.#labels, labelled);

    for (const entry of labelled) {
      const el = this.#labels.get(entry.key) ?? this.#createLabel(entry.key);

      el.setAttribute("fill", entry.region.color);
      // Paint-order draws the text casing beneath the glyphs.
      el.setAttribute("stroke", contrastingColor(entry.region.color));
      const { x, y } = this.#labelPosition(entry.geometry, zoom, camera);
      const corner = triangleCornerOf(entry.geometry);
      const rightAligned =
        corner === "top-right" || corner === "bottom-right";
      el.setAttribute("x", String(x));
      el.setAttribute("y", String(y));
      el.setAttribute("text-anchor", rightAligned ? "end" : "start");
      this.#setLabelContent(
        el,
        entry,
        showRegionLabels,
        x,
        y
      );

      // Append labels after rects to keep them visible.
      this.#group.appendChild(el);
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

      const grouped = region.state === "unfolded";
      if (grouped && this.#ghostSuppressed.has(entryKey(region.id, null))) {
        continue;
      }

      const override = this.#liveOverride;
      const groupDelta = grouped &&
        override !== null &&
        override.id === region.id &&
        override.face === null ?
        deltaOf(region.bounds, override.rect) :
        null;

      for (const { face, geometry } of region.facesOf()) {
        const key = entryKey(region.id, face);
        if (this.#ghostSuppressed.has(key)) {
          continue;
        }

        const overridden = override !== null &&
          override.id === region.id &&
          override.face === face;

        entries.push({
          key,
          region,
          face,
          geometry: this.#liveGeometry(geometry, overridden ? override.rect : null, groupDelta),
          selected: region.id === selectedRegionId &&
            (grouped || face === selectedFace)
        });
      }
    }

    return entries;
  }

  #liveGeometry(
    geometry: UVGeometry,
    rect: SelectionRect | null,
    delta: Vec2 | null
  ): UVGeometry {
    if (rect !== null) {
      return geometryAt(geometry, rect);
    }
    if (delta === null) {
      return geometry;
    }

    const bounds = rectOf(geometry);

    return geometryAt(geometry, {
      ...bounds,
      x: bounds.x + delta.x,
      y: bounds.y + delta.y
    });
  }

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
    key: string,
    geometry: UVGeometry
  ): UVRegionBorder {
    const border = new UVRegionBorder(geometry);
    this.#borders.set(key, border);

    return border;
  }

  #init(
    svg: SVGElement
  ): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");

    group.setAttribute("data-overlay", "uv");
    svg.appendChild(group);

    return group;
  }

  #labelPosition(
    geometry: UVGeometry,
    zoom: number,
    camera: Vec2
  ): Vec2 {
    const rect = rectOf(geometry);
    const screen = {
      x: rect.x * zoom + camera.x,
      y: rect.y * zoom + camera.y,
      width: rect.width * zoom,
      height: rect.height * zoom
    };
    const corner = triangleCornerOf(geometry);
    if (corner === null) {
      return {
        x: screen.x + kLabelPadding,
        y: screen.y + kLabelPadding + kLabelFontSize
      };
    }
    if (corner === "top-right") {
      return {
        x: screen.x + screen.width - kLabelPadding,
        y: screen.y + kLabelPadding + kLabelFontSize
      };
    }
    if (corner === "bottom-left") {
      return {
        x: screen.x + kLabelPadding,
        y: screen.y + screen.height - kLabelPadding
      };
    }
    if (corner === "bottom-right") {
      return {
        x: screen.x + screen.width - kLabelPadding,
        y: screen.y + screen.height - kLabelPadding
      };
    }

    return {
      x: screen.x + kLabelPadding,
      y: screen.y + kLabelPadding + kLabelFontSize
    };
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

    this.#group.appendChild(el);
    this.#labels.set(key, el);

    return el;
  }

  #setLabelContent(
    el: SVGTextElement,
    entry: RenderEntry,
    showRegionLabels: boolean,
    x: number,
    y: number
  ): void {
    if (!showRegionLabels) {
      el.textContent = faceLabel(entry);

      return;
    }

    if (entry.face === null) {
      el.textContent = regionLabel(entry.region);

      return;
    }

    el.replaceChildren();
    const corner = triangleCornerOf(entry.geometry);
    const bottomAligned =
      corner === "bottom-left" || corner === "bottom-right";
    const firstY = bottomAligned ? y - kLabelFontSize : y;

    const identity = document.createElementNS(SVG_NS, "tspan");
    identity.setAttribute("x", String(x));
    identity.setAttribute("y", String(firstY));
    identity.textContent = regionLabel(entry.region);
    el.appendChild(identity);

    const face = document.createElementNS(SVG_NS, "tspan");
    face.setAttribute("x", String(x));
    face.setAttribute("y", String(firstY + kLabelFontSize));
    face.textContent = faceLabel(entry);
    el.appendChild(face);
  }
}
