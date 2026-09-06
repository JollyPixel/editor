// Import Internal Dependencies
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import {
  copyGeometry,
  geometryAt,
  rectOf
} from "./geometry.ts";
import {
  UV_FACES,
  type UVFace,
  type UVGeometry
} from "./types.ts";

export class UVFaceMap {
  readonly #faces: Map<UVFace, UVGeometry>;

  static map<T>(
    fn: (face: UVFace) => T,
    faces: readonly UVFace[] = UV_FACES
  ): Record<UVFace, T> {
    return Object.fromEntries(
      faces.map((face) => [face, fn(face)])
    );
  }

  static shared(
    rect: SelectionRect,
    faces: readonly UVFace[] = UV_FACES
  ): UVFaceMap {
    return new UVFaceMap(
      UVFaceMap.map(() => rect, faces)
    );
  }

  constructor(
    faces: Record<UVFace, UVGeometry>
  ) {
    this.#faces = new Map(
      Object.keys(faces).map(
        (face) => [face, copyGeometry(faces[face])]
      )
    );
  }

  get faces(): readonly UVFace[] {
    return [...this.#faces.keys()];
  }

  has(
    face: UVFace
  ): boolean {
    return this.#faces.has(face);
  }

  get(
    face: UVFace
  ): UVGeometry {
    const geometry = this.#faces.get(face) ??
      this.#faces.values().next().value;

    return copyGeometry(geometry!);
  }

  withFace(
    face: UVFace,
    geometry: UVGeometry
  ): UVFaceMap {
    return new UVFaceMap(
      UVFaceMap.map(
        (mapFace) => (
          mapFace === face ? geometry : this.#faces.get(mapFace)!
        ),
        this.faces
      )
    );
  }

  stackedAt(
    origin: Vec2
  ): UVFaceMap {
    return new UVFaceMap(
      UVFaceMap.map(
        (face) => {
          const geometry = this.#faces.get(face)!;

          return geometryAt(geometry, {
            ...rectOf(geometry),
            x: origin.x,
            y: origin.y
          });
        },
        this.faces
      )
    );
  }

  translated(
    dx: number,
    dy: number
  ): UVFaceMap {
    return new UVFaceMap(
      UVFaceMap.map(
        (face) => {
          const geometry = this.#faces.get(face)!;
          const rect = rectOf(geometry);

          return geometryAt(geometry, {
            ...rect,
            x: rect.x + dx,
            y: rect.y + dy
          });
        },
        this.faces
      )
    );
  }

  toJSON(): Record<UVFace, UVGeometry> {
    return UVFaceMap.map(
      (face) => copyGeometry(this.#faces.get(face)!),
      this.faces
    );
  }
}
