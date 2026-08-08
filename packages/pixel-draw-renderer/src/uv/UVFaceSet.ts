// Import Internal Dependencies
import type { SelectionRect } from "../types.ts";
import { UVGeometryValue } from "./UVGeometryValue.ts";
import {
  UV_FACES,
  type UVFace,
  type UVGeometry
} from "./UVRegion.ts";

export class UVFaceSet {
  readonly #faces: Record<UVFace, UVGeometryValue>;
  readonly #activeFaces: readonly UVFace[];

  static shared(
    rect: SelectionRect,
    activeFaces: readonly UVFace[] = UV_FACES
  ): UVFaceSet {
    return new UVFaceSet({
      front: rect,
      back: rect,
      left: rect,
      right: rect,
      top: rect,
      bottom: rect
    }, activeFaces);
  }

  constructor(
    faces: Record<UVFace, UVGeometry>,
    activeFaces: readonly UVFace[] = UV_FACES
  ) {
    this.#faces = {
      front: new UVGeometryValue(faces.front),
      back: new UVGeometryValue(faces.back),
      left: new UVGeometryValue(faces.left),
      right: new UVGeometryValue(faces.right),
      top: new UVGeometryValue(faces.top),
      bottom: new UVGeometryValue(faces.bottom)
    };
    this.#activeFaces = [...activeFaces];
  }

  get(
    face: UVFace
  ): UVGeometryValue {
    return this.#faces[face];
  }

  get activeFaces(): readonly UVFace[] {
    return this.#activeFaces;
  }

  toJSON(): Record<UVFace, UVGeometry> {
    return Object.fromEntries(
      UV_FACES.map((face) => [face, this.#faces[face].toJSON()])
    ) as Record<UVFace, UVGeometry>;
  }

  withBounds(
    face: UVFace,
    rect: SelectionRect
  ): UVFaceSet {
    const faces = this.toJSON();
    faces[face] = this.#faces[face].withBounds(rect).toJSON();

    return new UVFaceSet(faces, this.#activeFaces);
  }
}
