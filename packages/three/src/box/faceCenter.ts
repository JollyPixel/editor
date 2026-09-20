// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type {
  Axis,
  AxisSign
} from "../common/axes.ts";

export interface BoxFace {
  axis: Axis;
  sign: AxisSign;
}

export function faceCenter(
  min: THREE.Vector3Like,
  size: THREE.Vector3Like,
  face: BoxFace,
  target: THREE.Vector3
): THREE.Vector3 {
  const { axis, sign } = face;

  target.set(
    min.x + (size.x / 2),
    min.y + (size.y / 2),
    min.z + (size.z / 2)
  );
  target[axis] = min[axis] + (sign === 1 ? size[axis] : 0);

  return target;
}
