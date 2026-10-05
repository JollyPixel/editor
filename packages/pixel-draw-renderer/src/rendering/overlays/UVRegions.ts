// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import { uvTargetKey } from "../../uv/region/UVTarget.ts";
import { UVRegionBorder } from "./UVRegionBorder.ts";
import { UVRegionLabels } from "./UVRegionLabels.ts";
import { UVSizeLabels } from "./UVSizeLabels.ts";
import { UVResizeHandles } from "./UVResizeHandles.ts";
import {
  projectUVOverlay,
  uvOverlayPaintOrder,
  type UVOverlayEntry
} from "./UVOverlayProjection.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
import type {
  UVGeometry,
  UVRegion,
  UVSlot
} from "../../uv/region/UVRegion.ts";

// CONSTANTS
const kStrokeWidth = 2;
const kSelectedStrokeWidth = 3;

export interface UVLivePreview {
  region: UVRegion;
  slot: UVSlot | null;
}

export interface UVPeerPreview {
  region: UVRegion;
  face: UVSlot | null;
  color: string;
}

interface UVPreviewEntry {
  key: string;
  geometry: UVGeometry;
  color: string;
}

export class UVRegionLayer {
  #viewport: DefaultViewport;
  #uvMap: UVMap;
  #group: SVGGElement;
  #borders = new Map<string, UVRegionBorder>();
  #labels: UVRegionLabels;
  #sizeLabels: UVSizeLabels;
  #livePreview: UVLivePreview | null = null;
  #resizeHandles = false;
  #handles: UVResizeHandles;
  #peerPreviews: ReadonlyMap<string, UVPeerPreview> = new Map();
  #peerSelections: ReadonlyMap<string, string> = new Map();

  #onChanged = () => this.#render();

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    uvMap: UVMap
  ) {
    this.#group = document.createElementNS(SVG_NS, "g");
    this.#group.setAttribute("data-overlay", "uv");
    svg.appendChild(this.#group);
    this.#viewport = viewport;
    this.#uvMap = uvMap;
    this.#labels = new UVRegionLabels(this.#group, viewport, uvMap);
    this.#sizeLabels = new UVSizeLabels(this.#group, viewport, uvMap);
    this.#handles = new UVResizeHandles(this.#group);

    this.#uvMap.on("changed", this.#onChanged);
  }

  setLivePreview(
    preview: UVLivePreview | null
  ): void {
    this.#livePreview = preview;
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

  setPeerPreviews(
    previews: ReadonlyMap<string, UVPeerPreview>
  ): void {
    this.#peerPreviews = previews;
    this.#render();
  }

  isPeerDragging(
    id: string
  ): boolean {
    for (const { region } of this.#peerPreviews.values()) {
      if (region.id === id) {
        return true;
      }
    }

    return false;
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
    this.#labels.destroy();
    this.#sizeLabels.destroy();
    this.#handles.destroy();
    this.#group.remove();
  }

  #render(): void {
    const entries = projectUVOverlay(this.#uvMap, {
      ghostSuppressed: new Set(
        [...this.#peerPreviews.values()].map(
          ({ region, face }) => uvTargetKey({ regionId: region.id, slot: face })
        )
      ),
      preview: this.#livePreview?.region ?? null,
      peerSelections: this.#peerSelections
    });
    const painted = uvOverlayPaintOrder(entries);
    const previews = this.#previewEntries();
    this.#pruneBorders([...painted, ...previews]);

    for (const entry of painted) {
      const emphasised = entry.selected && entry.region.state !== "stacked";
      this.#placeBorder(entry.key, entry.geometry, {
        color: entry.peerColor ?? entry.region.color,
        strokeWidth: emphasised ? kSelectedStrokeWidth : kStrokeWidth,
        selected: entry.selected,
        dimmed: entry.region.movementScope === "slot" && !entry.selected && entry.peerColor === null
      });
    }
    for (const preview of previews) {
      this.#placeBorder(preview.key, preview.geometry, {
        color: preview.color,
        strokeWidth: kStrokeWidth,
        selected: false,
        dimmed: false,
        dashed: true,
        casing: false
      });
    }

    this.#labels.render(entries);
    this.#sizeLabels.render(entries, this.#livePreview?.slot ?? null);
    this.#handles.render(
      this.#handleRegion(entries),
      this.#uvMap.selectedSlot,
      this.#viewport
    );
  }

  #placeBorder(
    key: string,
    geometry: UVGeometry,
    style: Parameters<UVRegionBorder["paint"]>[0]
  ): void {
    let border = this.#borders.get(key);
    if (border === undefined) {
      border = new UVRegionBorder();
      this.#borders.set(key, border);
    }

    border.place(geometry, this.#viewport);
    border.paint(style);
    border.appendTo(this.#group);
  }

  #previewEntries(): UVPreviewEntry[] {
    const entries: UVPreviewEntry[] = [];
    for (const [clientId, { region, face, color }] of this.#peerPreviews) {
      const geometries = face === null ?
        region.slotsOf() :
        [{ slot: face, geometry: region.geometryFor(face) }];
      for (const { slot, geometry } of geometries) {
        entries.push({
          key: `peer:${clientId}:${uvTargetKey({ regionId: region.id, slot })}`,
          geometry,
          color
        });
      }
    }

    return entries;
  }

  #pruneBorders(
    keep: readonly { key: string; }[]
  ): void {
    const keys = new Set(keep.map((entry) => entry.key));
    for (const [key, border] of this.#borders) {
      if (!keys.has(key)) {
        border.remove();
        this.#borders.delete(key);
      }
    }
  }

  #handleRegion(
    entries: UVOverlayEntry[]
  ): UVRegion | null {
    const id = this.#uvMap.selectedRegionId;
    if (
      !this.#resizeHandles ||
      this.#livePreview !== null ||
      id === null ||
      this.isPeerDragging(id)
    ) {
      return null;
    }

    return entries.find((entry) => entry.region.id === id)?.region ?? null;
  }
}
