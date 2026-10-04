// Import Internal Dependencies
import { rectOf } from "../geometry/geometry.ts";
import type { UVRegion } from "./UVRegion.ts";
import type { UVSlot } from "../geometry/types.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

export type UVResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

interface UVResizeTarget {
  id: string;
  slot: UVSlot | undefined;
  rect: SelectionRect;
  /** Unfolded net faces only get their east and south edges. */
  handles: readonly UVResizeHandle[];
}

/** Maps texture pixels to canvas pixels. */
export interface UVView {
  readonly zoom: { readonly value: number; };
  readonly camera: Readonly<Vec2>;
}

export interface UVResizeHit extends UVResizeTarget {
  handle: UVResizeHandle;
}

interface EdgeHit {
  end: boolean;
  distance: number;
}

// CONSTANTS
export const UV_RESIZE_HANDLE_SIZE = 7;
const kReach = 6;
const kEveryHandle: readonly UVResizeHandle[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw"
];
const kNetHandles: readonly UVResizeHandle[] = ["e", "s"];
const kHandleGrid = {
  n: { w: "nw", e: "ne", none: "n" },
  s: { w: "sw", e: "se", none: "s" },
  none: { w: "w", e: "e", none: null }
} as const satisfies Record<
  string,
  Record<string, UVResizeHandle | null>
>;

export const UV_RESIZE_CURSORS: Readonly<Record<UVResizeHandle, string>> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize"
};

export function resizeTargets(
  region: UVRegion,
  selectedSlot: UVSlot | null
): UVResizeTarget[] {
  if (!region.resizable) {
    return [];
  }
  if (region.state === "stacked") {
    return [
      {
        id: region.id,
        slot: undefined,
        rect: region.bounds,
        handles: kEveryHandle
      }
    ];
  }
  if (region.state === "free") {
    return selectedSlot === null ?
      [] :
      [
        {
          id: region.id,
          slot: selectedSlot,
          rect: region.rectFor(selectedSlot),
          handles: kEveryHandle
        }
      ];
  }

  return region.slotsOf().map(({ slot, geometry }) => {
    return {
      id: region.id,
      slot: slot ?? undefined,
      rect: rectOf(geometry),
      handles: kNetHandles
    };
  });
}

export function resizeHandleAt(
  targets: readonly UVResizeTarget[],
  point: Vec2,
  view: UVView
): UVResizeHit | null {
  let best: { hit: UVResizeHit; inside: boolean; distance: number; } | null = null;

  for (const target of targets) {
    const { handles } = target;
    const screen = screenRectOf(target.rect, view);
    let x = edgeAt(
      point.x,
      screen.x,
      screen.width,
      handles.includes("w"),
      handles.includes("e")
    );
    let y = edgeAt(
      point.y,
      screen.y,
      screen.height,
      handles.includes("n"),
      handles.includes("s")
    );
    const corner = handleOf(y, x);
    if (x !== null && y !== null && corner !== null && !handles.includes(corner)) {
      if (x.distance <= y.distance) {
        y = null;
      }
      else {
        x = null;
      }
    }
    const insideX = within(point.x, screen.x, screen.width);
    const insideY = within(point.y, screen.y, screen.height);
    const handle = handleOf(y, x);
    if (
      handle === null ||
      (x === null && !insideX) ||
      (y === null && !insideY)
    ) {
      continue;
    }

    const inside = insideX && insideY;
    const distance = Math.min(
      x?.distance ?? Infinity,
      y?.distance ?? Infinity
    );
    if (
      best === null ||
      inside && !best.inside ||
      inside === best.inside && distance < best.distance
    ) {
      best = {
        hit: {
          ...target,
          handle
        },
        inside,
        distance
      };
    }
  }

  return best?.hit ?? null;
}

export function resizedRect(
  base: SelectionRect,
  handle: UVResizeHandle,
  delta: Vec2
): SelectionRect {
  let left = base.x;
  let top = base.y;
  let right = base.x + base.width;
  let bottom = base.y + base.height;

  if (handle.includes("w")) {
    left = Math.min(left + delta.x, right - 1);
  }
  else if (handle.includes("e")) {
    right = Math.max(right + delta.x, left + 1);
  }
  if (handle.startsWith("n")) {
    top = Math.min(top + delta.y, bottom - 1);
  }
  else if (handle.startsWith("s")) {
    bottom = Math.max(bottom + delta.y, top + 1);
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

export function screenRectOf(
  rect: SelectionRect,
  view: UVView
): SelectionRect {
  const zoom = view.zoom.value;

  return {
    x: rect.x * zoom + view.camera.x,
    y: rect.y * zoom + view.camera.y,
    width: rect.width * zoom,
    height: rect.height * zoom
  };
}

function within(
  value: number,
  start: number,
  length: number
): boolean {
  return value >= start && value <= start + length;
}

function sideOf<T extends string>(
  hit: EdgeHit | null,
  start: T,
  end: T
): T | "none" {
  if (hit === null) {
    return "none";
  }

  return hit.end ? end : start;
}

function handleOf(
  y: EdgeHit | null,
  x: EdgeHit | null
): UVResizeHandle | null {
  return kHandleGrid[sideOf(y, "n", "s")][sideOf(x, "w", "e")];
}

function edgeAt(
  value: number,
  start: number,
  length: number,
  hasStart: boolean,
  hasEnd: boolean
): EdgeHit | null {
  const inner = Math.min(kReach, length / 3);
  const toStart = value - start;
  const toEnd = start + length - value;

  if (
    hasStart &&
    toStart >= -kReach &&
    toStart <= inner &&
    toStart <= toEnd
  ) {
    return {
      end: false,
      distance: Math.abs(toStart)
    };
  }
  if (hasEnd && toEnd >= -kReach && toEnd <= inner) {
    return {
      end: true,
      distance: Math.abs(toEnd)
    };
  }

  return null;
}
