// Import Internal Dependencies
import {
  geometryAt,
  rectOf,
  sameRect
} from "../geometry/geometry.ts";
import type { UVSlotMap } from "./UVSlotMap.ts";
import type {
  UVGeometry,
  UVSlot
} from "../geometry/types.ts";
import type { SelectionRect } from "../../types.ts";

interface Frame {
  forward: (rect: SelectionRect) => SelectionRect;
  inverse: (rect: SelectionRect) => SelectionRect;
}

function identity(
  rect: SelectionRect
): SelectionRect {
  return rect;
}

function mirrored(
  rect: SelectionRect
): SelectionRect {
  return {
    x: 0 - (rect.x + rect.width),
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

function transposed(
  rect: SelectionRect
): SelectionRect {
  return {
    x: rect.y,
    y: rect.x,
    width: rect.height,
    height: rect.width
  };
}

// CONSTANTS
const kFrames: Readonly<Record<UVEdge, Frame>> = {
  east: {
    forward: identity,
    inverse: identity
  },
  west: {
    forward: mirrored,
    inverse: mirrored
  },
  south: {
    forward: transposed,
    inverse: transposed
  },
  north: {
    forward: (rect) => mirrored(transposed(rect)),
    inverse: (rect) => transposed(mirrored(rect))
  }
};

function rowsOverlap(
  a: SelectionRect,
  b: SelectionRect
): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

function settleEast(
  rects: Map<UVSlot, SelectionRect>,
  slot: UVSlot,
  before: SelectionRect,
  after: SelectionRect
): void {
  const original = new Map(rects);
  original.set(slot, before);
  const placed = new Map<UVSlot, SelectionRect>([[slot, after]]);
  const others = [...original.keys()]
    .filter((other) => other !== slot)
    .sort((a, b) => original.get(a)!.x - original.get(b)!.x);

  for (const other of others) {
    const rect = original.get(other)!;
    let floor = -Infinity;
    let pull = 0;
    for (const [neighbor, moved] of placed) {
      const was = original.get(neighbor)!;
      const wasRight = was.x + was.width;
      if (wasRight > rect.x || !rowsOverlap(was, rect)) {
        continue;
      }

      floor = Math.max(floor, moved.x + moved.width);
      if (wasRight === rect.x) {
        pull = Math.min(pull, moved.x + moved.width - wasRight);
      }
    }

    placed.set(other, {
      ...rect,
      x: Math.max(rect.x + pull, floor)
    });
  }

  for (const [other, rect] of placed) {
    rects.set(other, rect);
  }
}

export type UVEdge = "east" | "west" | "south" | "north";

export interface UVAlignedResize {
  slot: UVSlot;
  edge: UVEdge;
  delta: number;
}

export function withEdgeMoved(
  rect: SelectionRect,
  edge: UVEdge,
  delta: number
): SelectionRect {
  const frame = kFrames[edge];
  const framed = frame.forward(rect);

  return frame.inverse({
    ...framed,
    width: Math.max(1, framed.width + delta)
  });
}

export function alignedResizes(
  faces: UVSlotMap,
  slots: readonly UVSlot[],
  slot: UVSlot,
  from: SelectionRect,
  to: SelectionRect
): UVAlignedResize[] {
  const resizes: UVAlignedResize[] = [];
  const edges: [UVEdge, number][] = [
    ["east", to.x + to.width - (from.x + from.width)],
    ["west", from.x - to.x],
    ["south", to.y + to.height - (from.y + from.height)],
    ["north", from.y - to.y]
  ];

  for (const [edge, delta] of edges) {
    if (delta === 0) {
      continue;
    }

    const frame = kFrames[edge];
    const rects = new Map(
      slots.map((other) => [other, frame.forward(rectOf(faces.get(other)))])
    );
    const line = frame.forward(from).x + frame.forward(from).width;
    const members = [frame.forward(from)];
    const pending = [...rects].filter(
      ([other, rect]) => other !== slot && rect.x + rect.width === line
    );

    let grew = true;
    while (grew) {
      grew = false;
      for (let index = pending.length - 1; index >= 0; index--) {
        const [other, rect] = pending[index];
        const touches = members.some(
          (member) => member.y + member.height === rect.y ||
            rect.y + rect.height === member.y
        );
        if (touches) {
          members.push(rect);
          pending.splice(index, 1);
          resizes.push({
            slot: other,
            edge,
            delta
          });
          grew = true;
        }
      }
    }
  }

  return resizes;
}

export function slidNeighbors(
  faces: UVSlotMap,
  slots: readonly UVSlot[],
  slot: UVSlot,
  from: SelectionRect,
  to: SelectionRect
): Map<UVSlot, UVGeometry> {
  const rects = new Map(
    slots.map((other) => [other, rectOf(faces.get(other))])
  );
  const east = {
    ...from,
    width: to.x + to.width - from.x
  };
  const west = {
    ...east,
    x: to.x,
    width: to.width
  };
  const south = {
    ...west,
    height: to.y + to.height - from.y
  };
  const steps: [SelectionRect, Frame][] = [
    [east, kFrames.east],
    [west, kFrames.west],
    [south, kFrames.south],
    [to, kFrames.north]
  ];

  let previous = from;
  for (const [next, frame] of steps) {
    if (sameRect(previous, next)) {
      continue;
    }

    const framed = new Map(
      [...rects].map(([other, rect]) => [other, frame.forward(rect)])
    );
    settleEast(
      framed,
      slot,
      frame.forward(previous),
      frame.forward(next)
    );
    for (const [other, rect] of framed) {
      rects.set(other, frame.inverse(rect));
    }
    previous = next;
  }

  const slid = new Map<UVSlot, UVGeometry>();
  for (const other of slots) {
    const rect = rects.get(other)!;
    if (other !== slot && !sameRect(rect, rectOf(faces.get(other)))) {
      slid.set(other, geometryAt(faces.get(other), rect));
    }
  }

  return slid;
}
