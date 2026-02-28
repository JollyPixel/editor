// Import Internal Dependencies
import type { UVHandleType } from "./types.ts";
import {
  UVRegion,
  type UVRegionData
} from "./UVRegion.ts";
import {
  UVHistory,
  type UVCommand
} from "./UVHistory.ts";

export interface UVMapChangedDetail {
  type: "add" | "remove" | "move" | "resize" | "label" | "select";
  regionId: string | null;
}

// CONSTANTS
const kDefaultColor = "#4af";

export interface UVMapOptions {
  maxHistorySize?: number;
}

export class UVMap extends EventTarget {
  #regions: Map<string, UVRegion> = new Map();
  #selectedId: string | null = null;
  #history: UVHistory;
  #nextId: number = 0;

  constructor(
    options?: UVMapOptions
  ) {
    super();
    this.#history = new UVHistory({
      maxSize: options?.maxHistorySize
    });
  }

  // ──────────────────────────── Region CRUD ────────────────────────────

  /**
   * Add a region directly without recording to history.
   * Use `createRegion` for undoable creation.
   */
  add(
    data: Omit<UVRegionData, "id"> & { id?: string; color?: string; }
  ): UVRegion {
    const id = data.id ?? `uv-${this.#nextId++}`;
    const region = new UVRegion({ ...data, id, color: data.color ?? kDefaultColor });
    this.#regions.set(id, region);

    return region;
  }

  /**
   * Remove a region directly without recording to history.
   * Use `deleteRegion` for undoable removal.
   */
  remove(id: string): boolean {
    const deleted = this.#regions.delete(id);
    if (deleted && this.#selectedId === id) {
      this.#selectedId = null;
    }

    return deleted;
  }

  get(id: string): UVRegion | undefined {
    return this.#regions.get(id);
  }

  has(id: string): boolean {
    return this.#regions.has(id);
  }

  [Symbol.iterator](): IterableIterator<UVRegion> {
    return this.#regions.values();
  }

  get size(): number {
    return this.#regions.size;
  }

  get selectedId(): string | null {
    return this.#selectedId;
  }

  select(id: string | null): void {
    this.#selectedId = id;
    this.#emitChanged("select", id);
  }

  createRegion(
    data: Omit<UVRegionData, "id"> & { id?: string; color?: string; }
  ): UVRegion {
    const id = data.id ?? `uv-${this.#nextId++}`;
    const region = new UVRegion({ ...data, id, color: data.color ?? kDefaultColor });
    this.#regions.set(id, region);
    this.#emitChanged("add", id);

    this.#history.push({
      type: "create",
      regionId: id,
      execute: () => {
        this.#regions.set(id, new UVRegion(region.toData()));
        this.#emitChanged("add", id);
      },
      undo: () => {
        this.#regions.delete(id);
        if (this.#selectedId === id) {
          this.#selectedId = null;
        }
        this.#emitChanged("remove", id);
      }
    });

    return region;
  }

  deleteRegion(
    id: string
  ): void {
    const region = this.#regions.get(id);
    if (!region) {
      return;
    }

    const snapshot = region.toData();
    this.#regions.delete(id);
    if (this.#selectedId === id) {
      this.#selectedId = null;
    }
    this.#emitChanged("remove", id);

    this.#history.push({
      type: "delete",
      regionId: id,
      execute: () => {
        this.#regions.delete(id);
        if (this.#selectedId === id) {
          this.#selectedId = null;
        }
        this.#emitChanged("remove", id);
      },
      undo: () => {
        this.#regions.set(id, new UVRegion(snapshot));
        this.#emitChanged("add", id);
      }
    });
  }

  /**
   * Move a region by a normalized UV delta and record to history.
   * Consecutive moves on the same region are coalesced into one history entry.
   */
  moveRegion(
    id: string,
    du: number,
    dv: number
  ): void {
    const region = this.#regions.get(id);
    if (!region) {
      return;
    }

    region.u += du;
    region.v += dv;
    region.clamp();
    this.#emitChanged("move", id);

    // Mutable accumulated delta — mutated by tryMerge
    let totalDu = du;
    let totalDv = dv;

    const cmd: UVCommand & { readonly _du: number; readonly _dv: number; } = {
      type: "move",
      regionId: id,
      _du: du,
      _dv: dv,
      execute: () => {
        const region = this.#regions.get(id);
        if (!region) {
          return;
        }

        region.u += totalDu;
        region.v += totalDv;
        region.clamp();
        this.#emitChanged("move", id);
      },
      undo: () => {
        const region = this.#regions.get(id);
        if (!region) {
          return;
        }

        region.u -= totalDu;
        region.v -= totalDv;
        region.clamp();
        this.#emitChanged("move", id);
      },
      tryMerge: (incoming) => {
        if (incoming.type !== "move" || incoming.regionId !== id) {
          return false;
        }

        const incomingMove = incoming as typeof cmd;
        totalDu += incomingMove._du;
        totalDv += incomingMove._dv;

        return true;
      }
    };

    this.#history.push(cmd);
  }

  /**
   * Resize a region by moving one of its handles and record to history.
   * Consecutive resizes with the same handle are coalesced.
   */
  resizeRegion(
    id: string,
    handle: UVHandleType,
    options: { du: number; dv: number; }
  ): void {
    const { du, dv } = options;
    const region = this.#regions.get(id);
    if (!region) {
      return;
    }

    const before = region.toData();
    applyHandleDelta(region, handle, { du, dv });
    region.clamp();
    this.#emitChanged("resize", id);

    // The "after" snapshot is updated by tryMerge as the drag continues.
    let afterData = region.toData();

    const cmd: UVCommand & {
      readonly _handle: UVHandleType;
      readonly _du: number;
      readonly _dv: number;
    } = {
      type: "resize",
      regionId: id,
      _handle: handle,
      _du: du,
      _dv: dv,
      execute: () => {
        const region = this.#regions.get(id);
        if (!region) {
          return;
        }

        region.fromData(afterData);
        this.#emitChanged("resize", id);
      },
      undo: () => {
        const region = this.#regions.get(id);
        if (!region) {
          return;
        }

        region.fromData(before);
        this.#emitChanged("resize", id);
      },
      tryMerge: (incoming) => {
        if (incoming.type !== "resize" || incoming.regionId !== id) {
          return false;
        }
        const incomingResize = incoming as typeof cmd;
        if (incomingResize._handle !== handle) {
          return false;
        }

        // Incoming has already been applied by the caller — capture current state.
        const region = this.#regions.get(id);
        if (region) {
          afterData = region.toData();
        }

        return true;
      }
    };

    this.#history.push(cmd);
  }

  /** Rename a region and record to history. */
  setLabel(
    id: string,
    label: string
  ): void {
    const region = this.#regions.get(id);
    if (!region) {
      return;
    }

    const oldLabel = region.label;
    region.label = label;
    this.#emitChanged("label", id);

    this.#history.push({
      type: "label",
      regionId: id,
      execute: () => {
        const region = this.#regions.get(id);
        if (!region) {
          return;
        }

        region.label = label;
        this.#emitChanged("label", id);
      },
      undo: () => {
        const region = this.#regions.get(id);
        if (!region) {
          return;
        }

        region.label = oldLabel;
        this.#emitChanged("label", id);
      }
    });
  }

  undo(): void {
    this.#history.undo();
  }

  redo(): void {
    this.#history.redo();
  }

  get canUndo(): boolean {
    return this.#history.canUndo;
  }

  get canRedo(): boolean {
    return this.#history.canRedo;
  }

  toJSON(): UVRegionData[] {
    return [
      ...this.#regions.values()
    ].map((region) => region.toData());
  }

  static fromJSON(
    data: UVRegionData[]
  ): UVMap {
    const map = new UVMap();
    for (const regionData of data) {
      map.add(regionData);
    }

    return map;
  }

  #emitChanged(
    type: UVMapChangedDetail["type"],
    regionId: string | null
  ): void {
    this.dispatchEvent(
      new CustomEvent<UVMapChangedDetail>("changed", {
        detail: { type, regionId }
      })
    );
  }
}

function applyHandleDelta(
  region: UVRegion,
  handle: UVHandleType,
  options: { du: number; dv: number; }
): void {
  const { du, dv } = options;

  switch (handle) {
    case "corner-tl":
      region.u += du;
      region.v += dv;
      region.width -= du;
      region.height -= dv;
      break;
    case "corner-tr":
      region.v += dv;
      region.width += du;
      region.height -= dv;
      break;
    case "corner-bl":
      region.u += du;
      region.width -= du;
      region.height += dv;
      break;
    case "corner-br":
      region.width += du;
      region.height += dv;
      break;
    case "edge-t":
      region.v += dv;
      region.height -= dv;
      break;
    case "edge-b":
      region.height += dv;
      break;
    case "edge-l":
      region.u += du;
      region.width -= du;
      break;
    case "edge-r":
      region.width += du;
      break;
    case "body":
      region.u += du;
      region.v += dv;
      break;
  }
}
