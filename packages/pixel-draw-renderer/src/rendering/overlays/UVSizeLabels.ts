// Import Third-party Dependencies
import { contrastingColor } from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  rectOf,
  triangleCornerOf
} from "../../uv/geometry/geometry.ts";
import { RectArea } from "../../utils/RectArea.ts";
import {
  SizeLabel,
  type SizeLabelPaint,
  type SizeLabelPlacement
} from "./SizeLabel.ts";
import type { UVOverlayEntry } from "./UVOverlayProjection.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
import type { UVSlot } from "../../uv/region/UVRegion.ts";

export class UVSizeLabels {
  #group: SVGGElement;
  #viewport: DefaultViewport;
  #uvMap: UVMap;
  #labels = new Map<string, SizeLabel>();

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
    entries: readonly UVOverlayEntry[],
    draggedSlot: UVSlot | null
  ): void {
    const measured = this.#uvMap.showSizeLabels ?
      UVSizeLabels.#measuredOf(entries) :
      new Map<string, UVOverlayEntry>();
    for (const [key, label] of this.#labels) {
      if (!measured.has(key)) {
        label.remove();
        this.#labels.delete(key);
      }
    }

    for (const [key, entry] of measured) {
      const paint = {
        fill: entry.region.color,
        stroke: contrastingColor(entry.region.color)
      };
      const label = this.#labels.get(key) ?? this.#create(key, paint);
      label.paint(paint);

      const inside = this.#inside(label, entry);
      const outside = label.outside(rectOf(entry.geometry));
      const prefersInside = (
        entry.region.state === "unfolded" && entry.slot !== draggedSlot
      ) || (inside !== null && this.#covers(outside, key, entries));
      label.show(prefersInside ? inside : outside);
      label.appendTo(this.#group);
    }
  }

  destroy(): void {
    for (const label of this.#labels.values()) {
      label.remove();
    }
    this.#labels.clear();
  }

  #create(
    key: string,
    paint: SizeLabelPaint
  ): SizeLabel {
    const label = new SizeLabel(this.#viewport, {
      ...paint,
      overlay: "uv-size"
    });
    this.#labels.set(key, label);

    return label;
  }

  #inside(
    label: SizeLabel,
    entry: UVOverlayEntry
  ): SizeLabelPlacement | null {
    const rect = rectOf(entry.geometry);
    const corner = triangleCornerOf(entry.geometry);
    if (corner === null) {
      return label.inside(rect);
    }

    const nameLines = (entry.slot === null ? 0 : 1) +
      (this.#uvMap.showRegionLabels ? 1 : 0);

    return label.insideTriangle(rect, corner, nameLines);
  }

  #covers(
    placement: SizeLabelPlacement | null,
    shapeKey: string,
    entries: readonly UVOverlayEntry[]
  ): boolean {
    if (placement === null) {
      return false;
    }

    const area = RectArea.from(placement.bounds);

    return entries.some((entry) => entry.shapeKey !== shapeKey &&
      area.clippedTo(
        this.#viewport.toScreenRect(rectOf(entry.geometry))
      ) !== null
    );
  }

  static #measuredOf(
    entries: readonly UVOverlayEntry[]
  ): Map<string, UVOverlayEntry> {
    const measured = new Map<string, UVOverlayEntry>();
    for (const entry of entries) {
      if (entry.selected && !measured.has(entry.shapeKey)) {
        measured.set(entry.shapeKey, entry);
      }
    }

    return measured;
  }
}
