// Import Internal Dependencies
import type { Rect } from "../../../src/geometry/Rect.ts";
import type { DragZone } from "../../../src/interaction/drag/DragSession.ts";

export function pointer(
  type: string,
  clientX: number,
  clientY: number
): PointerEvent {
  return new PointerEvent(type, {
    pointerId: 1,
    clientX,
    clientY
  });
}

export function rect(
  x: number,
  y: number,
  width: number,
  height: number
): Rect {
  return {
    x,
    y,
    width,
    height
  };
}

export function column(
  id: string,
  x: number,
  lines: number[]
): DragZone {
  return {
    id,
    rect: rect(x, 0, 100, 300),
    axis: "y",
    candidates: [
      {
        start: 0,
        size: 100
      },
      {
        start: 100,
        size: 100
      }
    ],
    line: (index) => {
      lines.push(index);

      return rect(x, index * 100, 100, 2);
    }
  };
}
