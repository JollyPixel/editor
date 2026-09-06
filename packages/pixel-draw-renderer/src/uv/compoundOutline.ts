// Import Internal Dependencies
import type { Vec2 } from "../types.ts";
import type { UVCompoundPart } from "./types.ts";

// CONSTANTS
// Vertices are keyed at this precision, so edges meeting after a float
// division still cancel.
const kQuantum = 1e6;
const kEpsilon = 1e-9;
const kTwoPi = Math.PI * 2;

interface Edge {
  from: Vec2;
  to: Vec2;
}

/**
 * Traces the union of a compound's parts into closed loops, expressed in the
 * `0` to `1` space the parts use.
 */
export function compoundOutline(
  parts: readonly UVCompoundPart[]
): Vec2[][] | null {
  if (parts.length === 0) {
    return null;
  }

  const edges = cancelInnerEdges(
    splitEdges(
      parts.flatMap(polygonEdges)
    )
  );

  return stitchLoops(edges);
}

function polygonEdges(
  part: UVCompoundPart
): Edge[] {
  const points = clockwise(
    partPoints(part)
  );

  return points.map((from, index) => {
    return {
      from,
      to: points[(index + 1) % points.length]
    };
  });
}

function partPoints(
  part: UVCompoundPart
): Vec2[] {
  const rect = "shape" in part ? part.rect : part;
  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  if (!("shape" in part)) {
    return [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom }
    ];
  }

  return {
    "top-left": [
      { x: left, y: top },
      { x: right, y: top },
      { x: left, y: bottom }
    ],
    "top-right": [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom }
    ],
    "bottom-left": [
      { x: left, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom }
    ],
    "bottom-right": [
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom }
    ]
  }[part.corner];
}

function clockwise(
  points: Vec2[]
): Vec2[] {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += (current.x * next.y) - (next.x * current.y);
  }

  // A y-down axis flips the sign, so a clockwise ring has a positive area.
  return area >= 0 ? points : [...points].reverse();
}

function splitEdges(
  edges: readonly Edge[]
): Edge[] {
  const vertices = new Map<string, Vec2>();
  for (const edge of edges) {
    vertices.set(vertexKey(edge.from), edge.from);
  }

  const result: Edge[] = [];
  for (const edge of edges) {
    const cuts = [...vertices.values()]
      .filter((vertex) => strictlyBetween(edge, vertex))
      .sort((a, b) => distanceAlong(edge, a) - distanceAlong(edge, b));

    let from = edge.from;
    for (const cut of [...cuts, edge.to]) {
      result.push({
        from,
        to: cut
      });
      from = cut;
    }
  }

  return result;
}

function cancelInnerEdges(
  edges: readonly Edge[]
): Edge[] {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    const key = edgeKey(edge.from, edge.to);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const survivors: Edge[] = [];
  const kept = new Map<string, number>();

  for (const edge of edges) {
    const key = edgeKey(edge.from, edge.to);
    const total = counts.get(key) ?? 0;
    const reversed = counts.get(edgeKey(edge.to, edge.from)) ?? 0;
    const remaining = total - Math.min(total, reversed);
    const taken = kept.get(key) ?? 0;
    if (taken >= remaining) {
      continue;
    }

    kept.set(key, taken + 1);
    survivors.push(edge);
  }

  return survivors;
}

function stitchLoops(
  edges: readonly Edge[]
): Vec2[][] | null {
  const pending = new Map<string, Edge[]>();
  for (const edge of edges) {
    const key = vertexKey(edge.from);
    const outgoing = pending.get(key);
    if (outgoing) {
      outgoing.push(edge);
    }
    else {
      pending.set(key, [edge]);
    }
  }

  const loops: Vec2[][] = [];
  let remaining = edges.length;

  for (const edge of edges) {
    if (!take(pending, edge)) {
      continue;
    }

    const loop = walkLoop(pending, edge);
    if (loop === null) {
      return null;
    }

    remaining -= loop.length;
    loops.push(simplifyLoop(loop));
  }

  return remaining === 0 && loops.length > 0 ? loops : null;
}

function walkLoop(
  pending: Map<string, Edge[]>,
  start: Edge
): Vec2[] | null {
  const points: Vec2[] = [start.from];
  let current = start;

  while (vertexKey(current.to) !== vertexKey(start.from)) {
    const next = sharpestTurn(pending, current);
    if (next === null) {
      return null;
    }

    take(pending, next);
    points.push(next.from);
    current = next;
  }

  return points;
}

function sharpestTurn(
  pending: Map<string, Edge[]>,
  edge: Edge
): Edge | null {
  const outgoing = pending.get(vertexKey(edge.to)) ?? [];
  if (outgoing.length < 2) {
    return outgoing[0] ?? null;
  }

  const incoming = angleOf(edge);
  let best: Edge | null = null;
  let bestTurn = Infinity;

  for (const candidate of outgoing) {
    let turn = (angleOf(candidate) - incoming) % kTwoPi;
    if (turn < kEpsilon) {
      // Straight on only when every other candidate turns away.
      turn += kTwoPi;
    }

    if (turn < bestTurn) {
      best = candidate;
      bestTurn = turn;
    }
  }

  return best;
}

function angleOf(
  edge: Edge
): number {
  return Math.atan2(
    edge.to.y - edge.from.y,
    edge.to.x - edge.from.x
  );
}

function take(
  pending: Map<string, Edge[]>,
  edge: Edge
): boolean {
  const key = vertexKey(edge.from);
  const outgoing = pending.get(key);
  const index = outgoing?.indexOf(edge) ?? -1;
  if (!outgoing || index === -1) {
    return false;
  }

  outgoing.splice(index, 1);
  if (outgoing.length === 0) {
    pending.delete(key);
  }

  return true;
}

function simplifyLoop(
  points: readonly Vec2[]
): Vec2[] {
  const result: Vec2[] = [];
  const count = points.length;

  for (let index = 0; index < count; index++) {
    const previous = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];

    if (cross(previous, current, next) !== 0) {
      result.push(current);
    }
  }

  return result.length > 0 ? result : [...points];
}

function cross(
  a: Vec2,
  b: Vec2,
  c: Vec2
): number {
  const value = ((b.x - a.x) * (c.y - a.y)) - ((b.y - a.y) * (c.x - a.x));

  return Math.abs(value) < kEpsilon ? 0 : value;
}

function strictlyBetween(
  edge: Edge,
  vertex: Vec2
): boolean {
  const key = vertexKey(vertex);
  if (key === vertexKey(edge.from) || key === vertexKey(edge.to)) {
    return false;
  }
  if (cross(edge.from, edge.to, vertex) !== 0) {
    return false;
  }

  const along = distanceAlong(edge, vertex);

  return along > 0 && along < 1;
}

function distanceAlong(
  edge: Edge,
  vertex: Vec2
): number {
  const dx = edge.to.x - edge.from.x;
  const dy = edge.to.y - edge.from.y;

  return Math.abs(dx) >= Math.abs(dy) ?
    (vertex.x - edge.from.x) / dx :
    (vertex.y - edge.from.y) / dy;
}

function vertexKey(
  vertex: Vec2
): string {
  return `${Math.round(vertex.x * kQuantum)},${Math.round(vertex.y * kQuantum)}`;
}

function edgeKey(
  from: Vec2,
  to: Vec2
): string {
  return `${vertexKey(from)}|${vertexKey(to)}`;
}
