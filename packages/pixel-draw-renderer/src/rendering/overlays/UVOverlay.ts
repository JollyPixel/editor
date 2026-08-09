// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import { contrastingColor } from "../../utils/colors.ts";
import {
  geometryAt,
  rectOf
} from "../../uv/geometry.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type { UVMap } from "../../uv/UVMap.ts";
import type {
  UVFace,
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
// Casing is this much wider than the main stroke.
const kCasingWidth = 2;
// Inset casing so it only shows inward.
const kCasingInset = kCasingWidth / 2;
const kDimOpacity = "0.45";
const kDashArray = "6 4";
const kSelectedFillOpacity = "0.06";
const kLabelFontSize = 10;
const kLabelPadding = 3;
const kLabelCasingWidth = "3";
// Hide labels on tiny rects.
const kLabelMinScreenSize = 40;
const kLabelMaxLength = 20;

/**
 * One rendered rect entry, with optional live-drag override applied.
 */
interface RenderEntry {
  key: string;
  region: UVRegion;
  face: UVFace | null;
  geometry: UVGeometry;
  selected: boolean;
}

export interface BorderStyle {
  color: string;
  strokeWidth: number;
  selected: boolean;
  dimmed: boolean;
  /** Dashed stroke used for a peer's in-progress (uncommitted) drag ghost. */
  dashed?: boolean;
  /**
   * Skips the contrasting (black/white) inner casing stroke, leaving just
   * the plain colored line. A dashed ghost reads better as a single clean
   * stroke than doubled up with a high-contrast casing.
   * @default true
   */
  casing?: boolean;
}

function entryKey(
  id: string,
  face: UVFace | null
): string {
  return `${id}:${face ?? "*"}`;
}

function geometryKey(
  geometry: UVGeometry
): string {
  const rect = rectOf(geometry);
  const { x, y, width, height } = rect;

  return "shape" in geometry ?
    `${geometry.shape}:${geometry.corner}:${x},${y},${width},${height}` :
    `${x},${y},${width},${height}`;
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
 * Border = colored stroke + inner contrasting casing for visibility.
 */
export class Border {
  #group: SVGGElement;
  #casing: SVGGeometryElement;
  #stroke: SVGGeometryElement;

  constructor(
    geometry: UVGeometry
  ) {
    this.#group = document.createElementNS(SVG_NS, "g");
    this.#group.style.pointerEvents = "none";

    this.#casing = this.#group.appendChild(Border.#createElement(geometry));
    this.#stroke = this.#group.appendChild(Border.#createElement(geometry));
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
    Border.#placeGeometry(this.#stroke, geometry, screen);

    // Keep casing inside the rect; clamp prevents negative size on tiny rects.
    const inset = Math.min(kCasingInset, screen.width / 2, screen.height / 2);
    Border.#placeGeometry(this.#casing, geometry, {
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
        "top-left": [[screen.x, screen.y], [screen.x + screen.width, screen.y],
          [screen.x, screen.y + screen.height]],
        "top-right": [[screen.x, screen.y], [screen.x + screen.width, screen.y],
          [screen.x + screen.width, screen.y + screen.height]],
        "bottom-left": [[screen.x, screen.y], [screen.x, screen.y + screen.height],
          [screen.x + screen.width, screen.y + screen.height]],
        "bottom-right": [[screen.x + screen.width, screen.y], [screen.x, screen.y + screen.height],
          [screen.x + screen.width, screen.y + screen.height]]
      }[uvGeometry.corner];
      el.setAttribute("points", corners.map((point) => point.join(",")).join(" "));

      return;
    }

    for (const [name, value] of Object.entries(screen)) {
      el.setAttribute(name, String(value));
    }
  }

  paint(
    style: BorderStyle
  ): void {
    const showCasing = style.casing ?? true;
    this.#casing.style.display = showCasing ? "" : "none";
    if (showCasing) {
      this.#casing.setAttribute("stroke", contrastingColor(style.color));
      this.#casing.style.strokeWidth = String(style.strokeWidth + kCasingWidth);
    }

    this.#stroke.setAttribute("stroke", style.color);
    this.#stroke.style.strokeWidth = String(style.strokeWidth);
    // Light fill marks the selected entry in stacked/similar rects.
    this.#stroke.style.fill = style.selected ? style.color : "none";
    this.#stroke.style.fillOpacity = style.selected ? kSelectedFillOpacity : "";

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
  #group: SVGGElement;
  #borders = new Map<string, Border>();
  #labels = new Map<string, SVGTextElement>();
  #liveOverride: { id: string; face: UVFace | null; rect: SelectionRect; } | null = null;
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

  /**
   * Replaces the set of region/face entries currently shown as a peer's live
   * drag ghost (`PeerUVGhosts`). Their classical rendering is suppressed
   * here so the ghost is the sole visual until it clears, instead of a
   * stale border sitting underneath it for the whole drag.
   */
  setGhostSuppressed(
    entries: Iterable<{ id: string; face: UVFace | null; }>
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
      // Uncollapsed regions show emphasis (+stroke) only on selected faces.
      const uncollapsed = entry.region.state === "uncollapsed";

      border.place(entry.geometry, zoom, camera);
      border.paint({
        color: entry.region.color,
        strokeWidth: uncollapsed && entry.selected ?
          kSelectedStrokeWidth :
          kStrokeWidth,
        selected: entry.selected,
        dimmed: uncollapsed && !entry.selected
      });
      border.appendTo(this.#group);
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
      // Entries follow UV_FACES order; group[0] matches the first hit target.
      const entry = group.find((candidate) => candidate.selected) ?? group[0];

      if (
        rectOf(entry.geometry).width * zoom < kLabelMinScreenSize ||
        rectOf(entry.geometry).height * zoom < kLabelMinScreenSize
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
      const { x, y } = this.#labelPosition(entry.geometry, zoom, camera);
      const rightAligned = "shape" in entry.geometry &&
        (entry.geometry.corner === "top-right" || entry.geometry.corner === "bottom-right");
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

      // Append after rects so labels stay visible.
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

      for (const { face, geometry } of region.facesOf()) {
        const key = entryKey(region.id, face);
        if (this.#ghostSuppressed.has(key)) {
          continue;
        }

        const override = this.#liveOverride;
        const overridden = override !== null &&
          override.id === region.id &&
          override.face === face;

        entries.push({
          key,
          region,
          face,
          geometry: overridden ? geometryAt(geometry, override.rect) : geometry,
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
    key: string,
    geometry: UVGeometry
  ): Border {
    const border = new Border(geometry);
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
    if (!("shape" in geometry)) {
      return {
        x: screen.x + kLabelPadding,
        y: screen.y + kLabelPadding + kLabelFontSize
      };
    }
    if (geometry.corner === "top-right") {
      return {
        x: screen.x + screen.width - kLabelPadding,
        y: screen.y + kLabelPadding + kLabelFontSize
      };
    }
    if (geometry.corner === "bottom-left") {
      return {
        x: screen.x + kLabelPadding,
        y: screen.y + screen.height - kLabelPadding
      };
    }
    if (geometry.corner === "bottom-right") {
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
      el.textContent = entry.face;

      return;
    }

    if (entry.face === null) {
      el.textContent = regionLabel(entry.region);

      return;
    }

    el.replaceChildren();
    const bottomAligned = "shape" in entry.geometry &&
      (entry.geometry.corner === "bottom-left" ||
        entry.geometry.corner === "bottom-right");
    const firstY = bottomAligned ? y - kLabelFontSize : y;

    const identity = document.createElementNS(SVG_NS, "tspan");
    identity.setAttribute("x", String(x));
    identity.setAttribute("y", String(firstY));
    identity.textContent = regionLabel(entry.region);
    el.appendChild(identity);

    const face = document.createElementNS(SVG_NS, "tspan");
    face.setAttribute("x", String(x));
    face.setAttribute("y", String(firstY + kLabelFontSize));
    face.textContent = entry.face;
    el.appendChild(face);
  }
}
