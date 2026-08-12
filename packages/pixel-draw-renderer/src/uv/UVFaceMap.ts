// Import Internal Dependencies
import type { SelectionRect } from "../types.ts";
import {
  copyGeometry,
  geometryAt
} from "./geometry.ts";
import {
  UV_FACES,
  type UVFace,
  type UVGeometry
} from "./types.ts";

/**
 * Copy-on-construct, copy-on-read per-face geometry. `UVRegion` never
 * touches a raw `Record<UVFace, UVGeometry>` directly once built.
 */
export class UVFaceMap {
  readonly #faces: Record<UVFace, UVGeometry>;

  static map<T>(
    fn: (face: UVFace) => T
  ): Record<UVFace, T> {
    return Object.fromEntries(
      UV_FACES.map((face) => [face, fn(face)])
    ) as Record<UVFace, T>;
  }

  static shared(
    rect: SelectionRect
  ): UVFaceMap {
    return new UVFaceMap(
      UVFaceMap.map(() => rect)
    );
  }

  constructor(
    faces: Record<UVFace, UVGeometry>
  ) {
    this.#faces = UVFaceMap.map(
      (face) => copyGeometry(faces[face])
    );
  }

  get(
    face: UVFace
  ): UVGeometry {
    return copyGeometry(this.#faces[face]);
  }

  withFace(
    face: UVFace,
    geometry: UVGeometry
  ): UVFaceMap {
    return new UVFaceMap(
      UVFaceMap.map(
        (mapFace) => (mapFace === face ? geometry : this.#faces[mapFace])
      )
    );
  }

  at(
    rect: SelectionRect
  ): UVFaceMap {
    return new UVFaceMap(
      UVFaceMap.map(
        (face) => geometryAt(this.#faces[face], rect)
      )
    );
  }

  toJSON(): Record<UVFace, UVGeometry> {
    return UVFaceMap.map(
      (face) => copyGeometry(this.#faces[face])
    );
  }
}
