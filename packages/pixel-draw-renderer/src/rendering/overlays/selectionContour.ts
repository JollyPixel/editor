// Import Internal Dependencies
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

// CONSTANTS
// Screen-space (y-down) unit steps, ordered so `(direction + 1) % 4` is a
// clockwise quarter turn.
const kDirections: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 }
];

// Right, straight, left, back: the sharpest clockwise turn wins.
const kTurnPreference: readonly number[] = [1, 0, 3, 2];

export interface SelectionContourScreen {
  zoom: number;
  camera: Vec2;
}

export function selectionContourPath(
  loop: Vec2[],
  rect: SelectionRect,
  screen: SelectionContourScreen
): string {
  function toScreenPoint(point: Vec2): string {
    const x = (rect.x + point.x) * screen.zoom + screen.camera.x;
    const y = (rect.y + point.y) * screen.zoom + screen.camera.y;

    return `${x} ${y}`;
  }

  return `M ${loop.map(toScreenPoint).join(" L ")} Z`;
}

/**
 * Traces a selection mask into closed contour loops.
 *
 * Cells touching only at a corner share a boundary vertex, so a vertex can
 * start two edges. Edges are therefore keyed by origin *and* direction, and
 * the walk always takes the sharpest clockwise turn, which keeps such cells
 * in separate loops (4-connected foreground).
 */
export function traceSelectionContour(
  width: number,
  height: number,
  mask: boolean[]
): Vec2[][] {
  const edges = collectBoundaryEdges(width, height, mask);
  const loops: Vec2[][] = [];

  while (edges.size > 0) {
    const [startKey] = edges;
    const [x, y, direction] = startKey.split(",").map(Number);

    loops.push(
      simplifyContour(
        walkLoop(edges, { x, y }, direction)
      )
    );
  }

  return loops;
}

function edgeKey(
  vertex: Vec2,
  direction: number
): string {
  return `${vertex.x},${vertex.y},${direction}`;
}

function collectBoundaryEdges(
  width: number,
  height: number,
  mask: boolean[]
): Set<string> {
  function isSelected(
    x: number,
    y: number
  ): boolean {
    return x >= 0 && x < width &&
      y >= 0 && y < height &&
      mask[(y * width) + x];
  }

  const edges = new Set<string>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[(y * width) + x]) {
        continue;
      }

      if (!isSelected(x, y - 1)) {
        edges.add(edgeKey({ x, y }, 0));
      }
      if (!isSelected(x + 1, y)) {
        edges.add(edgeKey({ x: x + 1, y }, 1));
      }
      if (!isSelected(x, y + 1)) {
        edges.add(edgeKey({ x: x + 1, y: y + 1 }, 2));
      }
      if (!isSelected(x - 1, y)) {
        edges.add(edgeKey({ x, y: y + 1 }, 3));
      }
    }
  }

  return edges;
}

function nextDirection(
  edges: Set<string>,
  vertex: Vec2,
  incoming: number
): number {
  for (const turn of kTurnPreference) {
    const direction = (incoming + turn) % 4;
    if (edges.has(edgeKey(vertex, direction))) {
      return direction;
    }
  }

  return -1;
}

function walkLoop(
  edges: Set<string>,
  start: Vec2,
  startDirection: number
): Vec2[] {
  const points: Vec2[] = [];
  let vertex = start;
  let direction = startDirection;

  for (;;) {
    edges.delete(edgeKey(vertex, direction));
    points.push(vertex);

    const step = kDirections[direction];
    vertex = {
      x: vertex.x + step.x,
      y: vertex.y + step.y
    };
    if (
      vertex.x === start.x &&
      vertex.y === start.y
    ) {
      break;
    }

    const next = nextDirection(edges, vertex, direction);
    // Unreachable for a well-formed mask; closing the partial loop keeps a
    // malformed one from hanging or crashing the overlay.
    if (next === -1) {
      break;
    }
    direction = next;
  }

  return points;
}

function simplifyContour(
  points: Vec2[]
): Vec2[] {
  const result: Vec2[] = [];
  const pointCount = points.length;

  for (let index = 0; index < pointCount; index++) {
    const previous = points[(index - 1 + pointCount) % pointCount];
    const current = points[index];
    const next = points[(index + 1) % pointCount];

    const collinear = (
      previous.x === current.x && current.x === next.x
    ) || (
      previous.y === current.y && current.y === next.y
    );
    if (!collinear) {
      result.push(current);
    }
  }

  return result.length > 0 ? result : points;
}
