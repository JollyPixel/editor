// Import Third-party Dependencies
import { contrastingColor } from "@jolly-pixel/color";

// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import {
  geometryKey,
  rectOf,
  triangleCornerOf
} from "../../uv/geometry/geometry.ts";
import { uvTargetKey } from "../../uv/region/UVTarget.ts";
import { UVRegionBorder } from "./UVRegionBorder.ts";
import { UVResizeHandles } from "./UVResizeHandles.ts";
import {
  projectUVOverlay,
  uvOverlayPaintOrder,
  type UVOverlayEntry
} from "./UVOverlayProjection.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
import type {
  UVSlot,
  UVGeometry,
  UVRegion
} from "../../uv/region/UVRegion.ts";
import type { Vec2 } from "../../types.ts";

// CONSTANTS
const kStrokeWidth = 2;
const kSelectedStrokeWidth = 3;
const kLabelFontSize = 10;
const kLabelPadding = 3;
const kLabelCasingWidth = "3";
// Hide labels on tiny rects.
const kLabelMinScreenSize = 40;
const kLabelMaxLength = 20;

function entryKey(
  id: string,
  face: UVSlot | null
): string {
  return uvTargetKey({
    regionId: id,
    slot: face
  });
}

function faceLabel(
  entry: UVOverlayEntry
): string {
  const hidden = (entry.stacked ?? 1) - 1;

  return hidden > 0 ? `${entry.slot} +${hidden}` : entry.slot ?? "";
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
  #livePreview: UVRegion | null = null;
  #resizeHandles = false;
  #handles: UVResizeHandles;
  #ghostSuppressed = new Set<string>();
  #peerSelections: ReadonlyMap<string, string> = new Map();

  #onChanged = () => this.#render();

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    uvMap: UVMap
  ) {
    this.#group = this.#init(svg);
    this.#handles = new UVResizeHandles(this.#group);
    this.#viewport = viewport;
    this.#uvMap = uvMap;

    this.#uvMap.on("changed", this.#onChanged);
  }

  setLivePreview(
    region: UVRegion | null
  ): void {
    this.#livePreview = region;
    this.#render();
  }

  set resizeHandles(
    value: boolean
  ) {
    this.#resizeHandles = value;
    this.#render();
  }

  refresh(): void {
    this.#render();
  }

  setGhostSuppressed(
    entries: Iterable<{ id: string; face: UVSlot | null; }>
  ): void {
    this.#ghostSuppressed = new Set(
      [...entries].map(({ id, face }) => entryKey(id, face))
    );
    this.#render();
  }

  setPeerSelections(
    colorByRegion: ReadonlyMap<string, string>
  ): void {
    this.#peerSelections = colorByRegion;
    this.#render();
  }

  destroy(): void {
    this.#uvMap.off("changed", this.#onChanged);

    for (const border of this.#borders.values()) {
      border.remove();
    }
    this.#borders.clear();
    for (const label of this.#labels.values()) {
      label.remove();
    }
    this.#labels.clear();
    this.#handles.destroy();
    this.#group.remove();
  }

  #render(): void {
    const entries = projectUVOverlay(this.#uvMap, {
      ghostSuppressed: this.#ghostSuppressed,
      preview: this.#livePreview,
      peerSelections: this.#peerSelections
    });
    const painted = uvOverlayPaintOrder(entries);

    this.#prune(this.#borders, painted);

    const zoom = this.#viewport.zoom.value;
    const camera = this.#viewport.camera;

    for (const entry of painted) {
      const border = this.#borders.get(
        entry.key
      ) ?? this.#createBorder(entry.key, entry.geometry);
      const perFace = entry.region.movementScope === "slot";
      const emphasised = entry.selected && entry.region.state !== "stacked";

      border.place(entry.geometry, zoom, camera);
      border.paint({
        color: entry.peerColor ?? entry.region.color,
        strokeWidth: emphasised ?
          kSelectedStrokeWidth :
          kStrokeWidth,
        selected: entry.selected,
        dimmed: perFace && !entry.selected && entry.peerColor === null
      });
      border.appendTo(this.#group);
    }

    this.#renderLabels(entries, zoom, camera);
    this.#handles.render(
      this.#handleRegion(entries),
      this.#uvMap.selectedSlot,
      this.#viewport
    );
  }

  #handleRegion(
    entries: UVOverlayEntry[]
  ): UVRegion | null {
    const id = this.#uvMap.selectedRegionId;
    if (!this.#resizeHandles || this.#livePreview !== null || id === null) {
      return null;
    }

    return entries.find((entry) => entry.region.id === id)?.region ?? null;
  }

  #renderLabels(
    entries: UVOverlayEntry[],
    zoom: number,
    camera: Vec2
  ): void {
    const showRegionLabels = this.#uvMap.showRegionLabels;
    const selectedOnly = this.#uvMap.labelScope === "selected";
    const groups = new Map<string, UVOverlayEntry[]>();
    for (const entry of entries) {
      if (
        selectedOnly &&
        entry.region.id !== this.#uvMap.selectedRegionId
      ) {
        continue;
      }
      if (entry.slot === null) {
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

    const labelled: UVOverlayEntry[] = [];
    for (const group of groups.values()) {
      const entry = group.find(
        (candidate) => candidate.selected
      ) ?? group[0];

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

      this.#group.appendChild(el);
    }
  }

  #prune<T extends { remove(): void; }>(
    elements: Map<string, T>,
    keep: UVOverlayEntry[]
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
    entry: UVOverlayEntry,
    showRegionLabels: boolean,
    x: number,
    y: number
  ): void {
    if (!showRegionLabels) {
      el.textContent = faceLabel(entry);

      return;
    }

    if (entry.slot === null) {
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
