// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type { UVMap } from "../../uv/UVMap.ts";
import type { UVRegion } from "../../uv/UVRegion.ts";
import type { SelectionRect } from "../../types.ts";

/**
 * Renders visible UV regions as solid colored border rects, self-updating
 * from `UVMap` events (create/delete/move/selection/visibility).
 */
export class UVOverlay {
  #viewport: DefaultViewport;
  #uvMap: UVMap;
  #svg: SVGElement;
  #rects = new Map<string, SVGRectElement>();
  #liveOverride: { id: string; rect: SelectionRect; } | null = null;

  #onRegionCreated = () => this.#render();
  #onRegionDeleted = () => this.#render();
  #onRegionMoved = () => this.#render();
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
    this.#uvMap.on("selection-changed", this.#onSelectionChanged);
    this.#uvMap.on("visibility-changed", this.#onVisibilityChanged);
  }

  /**
   * Overrides one region's rendered rect during an active drag, without
   * mutating `UVMap` state. Pass `null` to clear the override.
   */
  setLiveOverride(
    id: string,
    rect: SelectionRect | null
  ): void {
    this.#liveOverride = rect ? { id, rect } : null;
    this.#render();
  }

  /**
   * Re-renders against the current viewport transform (pan/zoom).
   */
  refresh(): void {
    this.#render();
  }

  destroy(): void {
    this.#uvMap.off("region-created", this.#onRegionCreated);
    this.#uvMap.off("region-deleted", this.#onRegionDeleted);
    this.#uvMap.off("region-moved", this.#onRegionMoved);
    this.#uvMap.off("selection-changed", this.#onSelectionChanged);
    this.#uvMap.off("visibility-changed", this.#onVisibilityChanged);

    for (const rect of this.#rects.values()) {
      rect.remove();
    }
    this.#rects.clear();
  }

  #render(): void {
    const visible: UVRegion[] = [];
    const visibleIds = new Set<string>();
    for (const region of this.#uvMap.regions) {
      if (!this.#uvMap.isVisible(region.id)) {
        continue;
      }
      visible.push(region);
      visibleIds.add(region.id);
    }

    for (const [id, el] of this.#rects) {
      if (!visibleIds.has(id)) {
        el.remove();
        this.#rects.delete(id);
      }
    }

    const zoom = this.#viewport.zoom.value;
    const camera = this.#viewport.camera;

    for (const region of visible) {
      const rect = (this.#liveOverride && this.#liveOverride.id === region.id) ?
        this.#liveOverride.rect :
        region.rect;

      const el = this.#rects.get(region.id) ?? this.#createRect(region.id);
      el.setAttribute("stroke", region.color);
      el.setAttribute("x", String(rect.x * zoom + camera.x));
      el.setAttribute("y", String(rect.y * zoom + camera.y));
      el.setAttribute("width", String(rect.width * zoom));
      el.setAttribute("height", String(rect.height * zoom));
    }
  }

  #createRect(
    id: string
  ): SVGRectElement {
    const el = document.createElementNS(SVG_NS, "rect");

    Object.assign(el.style, {
      pointerEvents: "none",
      fill: "none",
      strokeWidth: 2
    });
    el.setAttribute("vector-effect", "non-scaling-stroke");

    this.#svg.appendChild(el);
    this.#rects.set(id, el);

    return el;
  }
}
