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
  type UVSlot,
  type UVGeometry
} from "./types.ts";

export class UVSlotMap {
  readonly #faces: Map<UVSlot, UVGeometry>;

  static map<T>(
    fn: (face: UVSlot) => T,
    faces: readonly UVSlot[] = UV_FACES
  ): Record<UVSlot, T> {
    return Object.fromEntries(
      faces.map((face) => [face, fn(face)])
    );
  }

  static shared(
    rect: SelectionRect,
    faces: readonly UVSlot[] = UV_FACES
  ): UVSlotMap {
    return new UVSlotMap(
      UVSlotMap.map(() => rect, faces)
    );
  }

  constructor(
    faces: Record<UVSlot, UVGeometry>
  ) {
    const slots = Object.keys(faces);
    if (slots.length === 0) {
      throw new RangeError("A UV slot map must contain at least one slot");
    }

    this.#faces = new Map(
      slots.map(
        (face) => [face, copyGeometry(faces[face])]
      )
    );
  }

  get faces(): readonly UVSlot[] {
    return [...this.#faces.keys()];
  }

  has(
    face: UVSlot
  ): boolean {
    return this.#faces.has(face);
  }

  get(
    face: UVSlot
  ): UVGeometry {
    const geometry = this.#faces.get(face);
    if (geometry === undefined) {
      throw new RangeError(`Unknown UV slot "${face}"`);
    }

    return copyGeometry(geometry);
  }

  get primaryFace(): UVSlot {
    return this.#faces.keys().next().value!;
  }

  withFace(
    face: UVSlot,
    geometry: UVGeometry
  ): UVSlotMap {
    if (!this.#faces.has(face)) {
      throw new RangeError(`Unknown UV slot "${face}"`);
    }

    return new UVSlotMap(
      UVSlotMap.map(
        (mapFace) => (
          mapFace === face ? geometry : this.#faces.get(mapFace)!
        ),
        this.faces
      )
    );
  }

  stackedAt(
    origin: Vec2
  ): UVSlotMap {
    return new UVSlotMap(
      UVSlotMap.map(
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
  ): UVSlotMap {
    return new UVSlotMap(
      UVSlotMap.map(
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

  toJSON(): Record<UVSlot, UVGeometry> {
    return UVSlotMap.map(
      (face) => copyGeometry(this.#faces.get(face)!),
      this.faces
    );
  }
}
