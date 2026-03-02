// Import Internal Dependencies
import type {
  UVHandle,
  UVHandleType,
  Vec2
} from "./types.ts";
import type { Viewport } from "./Viewport.ts";
import type { UVMap } from "./UVMap.ts";
import type { UVRenderer } from "./UVRenderer.ts";

// CONSTANTS
const kHitRadius = 8;
const kMinRegionSize = 0.01;
const kDefaultEdgeSnapThreshold = 0.02;
const kHandleTypes: readonly UVHandleType[] = [
  "corner-tl",
  "corner-tr",
  "corner-bl",
  "corner-br",
  "edge-t",
  "edge-b",
  "edge-l",
  "edge-r"
];

export interface UVSnappingOptions {
  /**
   * Snap u, v coordinates to the nearest texture pixel boundary.
   * @default true
   **/
  pixelSnap: boolean;
  /**
   * Snap edges to other region edges when within edgeSnapThreshold.
   * @default false
   **/
  edgeSnap: boolean;
  /**
   * Normalized UV distance within which edge snapping activates.
   * @default 0.02
   **/
  edgeSnapThreshold: number;
}

export interface UVInputHandlerOptions {
  viewport: Viewport;
  uvMap: UVMap;
  uvRenderer: UVRenderer;
  textureSize: Vec2;
  snapping?: Partial<UVSnappingOptions>;
  onRegionSelected?: (id: string | null) => void;
}

type InteractionState =
  | { kind: "idle"; }
  | { kind: "creating"; startU: number; startV: number; currentU: number; currentV: number; }
  | { kind: "moving"; regionId: string; lastU: number; lastV: number; }
  | { kind: "resizing"; regionId: string; handle: UVHandleType; lastU: number; lastV: number; };

/**
 * UV-mode state machine.
 * Receives canvas-space coordinates from InputController callbacks and
 * translates them into UVMap mutations.
 */
export class UVInputHandler {
  #uvMap: UVMap;
  #uvRenderer: UVRenderer;
  #textureSize: Vec2;
  #snapping: UVSnappingOptions;
  #onRegionSelected: ((id: string | null) => void) | undefined;
  #state: InteractionState = { kind: "idle" };

  constructor(
    options: UVInputHandlerOptions
  ) {
    this.#uvMap = options.uvMap;
    this.#uvRenderer = options.uvRenderer;
    this.#textureSize = options.textureSize;
    this.#onRegionSelected = options.onRegionSelected;

    this.#snapping = {
      pixelSnap: options.snapping?.pixelSnap ?? true,
      edgeSnap: options.snapping?.edgeSnap ?? false,
      edgeSnapThreshold: options.snapping?.edgeSnapThreshold ?? kDefaultEdgeSnapThreshold
    };
  }

  onMouseDown(
    canvasX: number,
    canvasY: number,
    button: number
  ): void {
    if (button !== 0) {
      return;
    }

    // Hit-test handles first (only for selected region)
    const handle = this.hitTestHandle(canvasX, canvasY);
    if (handle) {
      const uv = this.#uvRenderer.svgToUV(canvasX, canvasY);
      const snapped = this.snapUV(uv.x, uv.y);
      this.#state = {
        kind: "resizing",
        regionId: handle.regionId,
        handle: handle.type,
        lastU: snapped.x,
        lastV: snapped.y
      };

      return;
    }

    // Hit-test region bodies
    const regionId = this.hitTestRegion(canvasX, canvasY);
    if (regionId) {
      this.#uvMap.select(regionId);
      this.#onRegionSelected?.(regionId);

      const uv = this.#uvRenderer.svgToUV(canvasX, canvasY);
      const snapped = this.snapUV(uv.x, uv.y);
      this.#state = {
        kind: "moving",
        regionId,
        lastU: snapped.x,
        lastV: snapped.y
      };

      return;
    }

    // Empty space — start creating
    this.#uvMap.select(null);
    this.#onRegionSelected?.(null);

    const uv = this.#uvRenderer.svgToUV(canvasX, canvasY);
    const snapped = this.snapUV(uv.x, uv.y);
    this.#state = {
      kind: "creating",
      startU: snapped.x,
      startV: snapped.y,
      currentU: snapped.x,
      currentV: snapped.y
    };
  }

  onMouseMove(
    canvasX: number,
    canvasY: number
  ): void {
    const uv = this.#uvRenderer.svgToUV(canvasX, canvasY);
    const snapped = this.snapUV(uv.x, uv.y);

    switch (this.#state.kind) {
      case "moving": {
        const { regionId } = this.#state;
        const du = snapped.x - this.#state.lastU;
        const dv = snapped.y - this.#state.lastV;
        if (du !== 0 || dv !== 0) {
          this.#state = { ...this.#state, lastU: snapped.x, lastV: snapped.y };
          this.#uvMap.moveRegion(regionId, du, dv);
        }

        break;
      }
      case "resizing": {
        const { regionId, handle } = this.#state;
        const du = snapped.x - this.#state.lastU;
        const dv = snapped.y - this.#state.lastV;
        if (du !== 0 || dv !== 0) {
          this.#state = { ...this.#state, lastU: snapped.x, lastV: snapped.y };
          this.#uvMap.resizeRegion(regionId, handle, { du, dv });
        }

        break;
      }
      case "creating": {
        this.#state = { ...this.#state, currentU: snapped.x, currentV: snapped.y };
        this.#uvRenderer.setDragPreview(this.#buildPreviewData());

        break;
      }
      default:
        break;
    }
  }

  onMouseUp(): void {
    if (this.#state.kind === "creating") {
      const preview = this.#buildPreviewData();
      this.#uvRenderer.setDragPreview(null);

      if (
        preview &&
        preview.width >= kMinRegionSize &&
        preview.height >= kMinRegionSize
      ) {
        const region = this.#uvMap.createRegion(preview);
        this.#uvMap.select(region.id);
        this.#onRegionSelected?.(region.id);
      }
    }

    this.#state = { kind: "idle" };
  }

  onDeleteKey(): void {
    const selected = this.#uvMap.selectedId;
    if (selected) {
      this.#uvMap.deleteRegion(selected);
      this.#onRegionSelected?.(null);
    }
  }

  /**
   * Return the handle under the given canvas position, or `null`.
   * Only handles of the currently selected region are checked.
   */
  hitTestHandle(
    cx: number,
    cy: number
  ): UVHandle | null {
    const selectedId = this.#uvMap.selectedId;
    if (!selectedId) {
      return null;
    }
    const region = this.#uvMap.get(selectedId);
    if (!region) {
      return null;
    }

    const positions = this.#getHandlePositions(region.u, region.v, {
      width: region.width,
      height: region.height
    });

    for (const ht of kHandleTypes) {
      const pos = positions[ht];
      if (!pos) {
        continue;
      }

      const dx = cx - pos.x;
      const dy = cy - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) <= kHitRadius) {
        return { regionId: selectedId, type: ht };
      }
    }

    return null;
  }

  /**
   * Return the id of the topmost region containing the given canvas position,
   * or `null` if none.
   */
  hitTestRegion(
    cx: number,
    cy: number
  ): string | null {
    const uv = this.#uvRenderer.svgToUV(cx, cy);

    // Iterate in reverse insertion order so later-added regions are "on top"
    const regionIds = [...this.#uvMap]
      .map((region) => region.id)
      .reverse();
    for (const id of regionIds) {
      const r = this.#uvMap.get(id);
      if (!r) {
        continue;
      }
      if (
        uv.x >= r.u &&
        uv.x <= r.u + r.width &&
        uv.y >= r.v &&
        uv.y <= r.v + r.height
      ) {
        return id;
      }
    }

    return null;
  }

  /**
   * Snap a UV coordinate according to current snapping options.
   * Pixel snap is applied first, then edge snap (if enabled).
   */
  snapUV(
    u: number,
    v: number
  ): Vec2 {
    let su = u;
    let sv = v;

    if (this.#snapping.pixelSnap) {
      const tw = this.#textureSize.x;
      const th = this.#textureSize.y;
      su = Math.round(su * tw) / tw;
      sv = Math.round(sv * th) / th;
    }

    if (this.#snapping.edgeSnap) {
      const threshold = this.#snapping.edgeSnapThreshold;
      const excludeId =
        this.#state.kind === "moving" || this.#state.kind === "resizing"
          ? this.#state.regionId
          : undefined;

      for (const region of this.#uvMap) {
        if (region.id === excludeId) {
          continue;
        }
        const edges = [region.u, region.u + region.width];
        for (const eu of edges) {
          if (Math.abs(su - eu) < threshold) {
            su = eu;
            break;
          }
        }
        const edgesV = [region.v, region.v + region.height];
        for (const ev of edgesV) {
          if (Math.abs(sv - ev) < threshold) {
            sv = ev;
            break;
          }
        }
      }
    }

    return { x: su, y: sv };
  }

  destroy(): void {
    this.#state = { kind: "idle" };
    this.#uvRenderer.setDragPreview(null);
  }

  #getHandlePositions(
    u: number,
    v: number,
    options: { width: number; height: number; }
  ): Partial<Record<UVHandleType, Vec2>> {
    const { width, height } = options;
    const toSvg = (pu: number, pv: number) => this.#uvRenderer.uvToSvg(pu, pv);

    return {
      "corner-tl": toSvg(u, v),
      "corner-tr": toSvg(u + width, v),
      "corner-bl": toSvg(u, v + height),
      "corner-br": toSvg(u + width, v + height),
      "edge-t": toSvg(u + width / 2, v),
      "edge-b": toSvg(u + width / 2, v + height),
      "edge-l": toSvg(u, v + height / 2),
      "edge-r": toSvg(u + width, v + height / 2)
    };
  }

  #buildPreviewData() {
    if (this.#state.kind !== "creating") {
      return null;
    }

    const { startU, startV, currentU, currentV } = this.#state;
    const u = Math.min(startU, currentU);
    const v = Math.min(startV, currentV);
    const width = Math.abs(currentU - startU);
    const height = Math.abs(currentV - startV);

    return {
      id: "__preview__",
      label: "",
      u,
      v,
      width,
      height,
      color: "#4af"
    };
  }
}
