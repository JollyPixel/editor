// Import Internal Dependencies
import {
  UVMap,
  type UVMapEvent,
  type UVMapEventType
} from "#src/uv/UVMap.ts";
import type { Vec2 } from "#src/types.ts";

export type EventPayload<T extends UVMapEventType> = Parameters<UVMapEvent[T]>[0];

export function makeMap(
  size: Vec2 = { x: 32, y: 32 }
): UVMap {
  return new UVMap({ getCanvasSize: () => size });
}
