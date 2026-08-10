// Import Internal Dependencies
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

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
 */
export function traceSelectionContour(
  width: number,
  height: number,
  mask: boolean[]
): Vec2[][] {
  function isSelected(
    x: number,
    y: number
  ): boolean {
    return x >= 0 && x < width &&
      y >= 0 && y < height &&
      mask[(y * width) + x];
  }

  const edges = new Map<string, Vec2>();
  function setEdge(from: Vec2, to: Vec2): void {
    edges.set(`${from.x},${from.y}`, to);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[(y * width) + x]) {
        continue;
      }

      if (!isSelected(x, y - 1)) {
        setEdge(
          { x, y },
          { x: x + 1, y }
        );
      }
      if (!isSelected(x + 1, y)) {
        setEdge(
          { x: x + 1, y },
          { x: x + 1, y: y + 1 }
        );
      }
      if (!isSelected(x, y + 1)) {
        setEdge(
          { x: x + 1, y: y + 1 },
          { x, y: y + 1 }
        );
      }
      if (!isSelected(x - 1, y)) {
        setEdge(
          { x, y: y + 1 },
          { x, y }
        );
      }
    }
  }

  const loops: Vec2[][] = [];
  while (edges.size > 0) {
    const [startKey] = edges.keys();
    const [startX, startY] = startKey.split(",").map(Number);
    let current: Vec2 = {
      x: startX,
      y: startY
    };

    const points: Vec2[] = [current];
    for (;;) {
      const next = edges.get(`${current.x},${current.y}`)!;
      edges.delete(`${current.x},${current.y}`);
      if (next.x === startX && next.y === startY) {
        break;
      }
      points.push(next);
      current = next;
    }

    loops.push(simplifyContour(points));
  }

  return loops;
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
