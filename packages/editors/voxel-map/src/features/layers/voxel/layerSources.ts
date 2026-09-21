// Import Third-party Dependencies
import type {
  FieldSource,
  Vec3Like
} from "@jolly-pixel/ui";

// CONSTANTS
const kOrigin: Vec3Like = {
  x: 0,
  y: 0,
  z: 0
};

export interface LayerPositionPort {
  position(): Vec3Like | null;
  move(position: Vec3Like): void;
}

export interface GizmoPort {
  enabled(): boolean;
  toggle(enabled: boolean): void;
}

export function layerPositionSource(
  port: LayerPositionPort
): FieldSource<Vec3Like> {
  return {
    read: () => roundPosition(port.position() ?? kOrigin),
    write: (value) => {
      const current = port.position();
      if (current === null) {
        return;
      }

      const position = roundPosition(value);
      if (samePosition(position, roundPosition(current))) {
        return;
      }

      port.move(position);
    }
  };
}

export function gizmoSource(
  port: GizmoPort
): FieldSource<boolean> {
  return {
    read: () => port.enabled(),
    write: (value) => port.toggle(value)
  };
}

export function roundPosition(
  position: Vec3Like
): Vec3Like {
  return {
    x: Math.round(position.x),
    y: Math.round(position.y),
    z: Math.round(position.z)
  };
}

export function samePosition(
  left: Vec3Like,
  right: Vec3Like
): boolean {
  return left.x === right.x &&
    left.y === right.y &&
    left.z === right.z;
}
