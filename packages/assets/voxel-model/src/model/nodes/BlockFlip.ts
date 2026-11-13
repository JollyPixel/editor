// Import Internal Dependencies
import type { MirrorAxes } from "../types.ts";
import { Vector3 } from "./Vector3.ts";

export class BlockFlip {
  static readonly none: Readonly<MirrorAxes> = Object.freeze({
    x: false,
    y: false,
    z: false
  });

  static isMirrored(
    axes: Readonly<MirrorAxes>
  ): boolean {
    return axes.x || axes.y || axes.z;
  }

  static same(
    left: Readonly<MirrorAxes>,
    right: Readonly<MirrorAxes>
  ): boolean {
    return Vector3.same(left, right);
  }
}
