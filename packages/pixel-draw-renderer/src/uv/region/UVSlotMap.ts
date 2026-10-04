// Import Internal Dependencies
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";
import {
  copyGeometry,
  geometryAt,
  quarterTurn,
  rectOf,
  rotateGeometry,
  rotateRect
} from "../geometry/geometry.ts";
import {
  DEFAULT_UV_SLOTS,
  type UVSlot,
  type UVGeometry
} from "../geometry/types.ts";

export class UVSlotMap {
  readonly #slots: Map<UVSlot, UVGeometry>;

  static shared(
    geometry: UVGeometry,
    faces: readonly UVSlot[] = DEFAULT_UV_SLOTS
  ): UVSlotMap {
    return new UVSlotMap(
      Object.fromEntries(faces.map((face) => [face, geometry]))
    );
  }

  constructor(
    slots: Record<UVSlot, UVGeometry>
  ) {
    const entries = Object.entries(slots);
    if (entries.length === 0) {
      throw new RangeError("A UV slot map must contain at least one slot");
    }

    this.#slots = new Map(
      entries.map(([slot, geometry]) => [slot, copyGeometry(geometry)])
    );
  }

  get slots(): readonly UVSlot[] {
    return [...this.#slots.keys()];
  }

  has(
    face: UVSlot
  ): boolean {
    return this.#slots.has(face);
  }

  get(
    face: UVSlot
  ): UVGeometry {
    const geometry = this.#slots.get(face);
    if (geometry === undefined) {
      throw new RangeError(`Unknown UV slot "${face}"`);
    }

    return copyGeometry(geometry);
  }

  withSlot(
    slot: UVSlot,
    geometry: UVGeometry
  ): UVSlotMap {
    if (!this.#slots.has(slot)) {
      throw new RangeError(`Unknown UV slot "${slot}"`);
    }

    return this.withSlots(new Map([[slot, geometry]]));
  }

  withSlots(
    entries: ReadonlyMap<UVSlot, UVGeometry>
  ): UVSlotMap {
    return this.#mapped((geometry, slot) => entries.get(slot) ?? geometry);
  }

  stackedAt(
    origin: Vec2
  ): UVSlotMap {
    return this.#mapped((geometry) => geometryAt(geometry, {
      ...rectOf(geometry),
      x: origin.x,
      y: origin.y
    }));
  }

  translated(
    dx: number,
    dy: number
  ): UVSlotMap {
    return this.#mapped((geometry) => {
      const rect = rectOf(geometry);

      return geometryAt(geometry, {
        ...rect,
        x: rect.x + dx,
        y: rect.y + dy
      });
    });
  }

  rotated(
    turns: number,
    slots: readonly UVSlot[] = this.slots
  ): UVSlotMap {
    return this.#mapped((geometry, slot) => (
      slots.includes(slot) ? rotateGeometry(geometry, turns) : geometry
    ));
  }

  rotatedWithin(
    frame: SelectionRect,
    turns: number
  ): UVSlotMap {
    return this.#mapped((source) => {
      let geometry = source;
      let height = frame.height;
      let width = frame.width;
      for (let turn = 0; turn < quarterTurn(turns); turn++) {
        const rect = rectOf(geometry);
        geometry = geometryAt(rotateGeometry(geometry, 1), {
          ...rotateRect(rect, 1),
          x: frame.x + height - (rect.y - frame.y + rect.height),
          y: frame.y + (rect.x - frame.x)
        });
        [width, height] = [height, width];
      }

      return geometry;
    });
  }

  toJSON(): Record<UVSlot, UVGeometry> {
    return Object.fromEntries(
      [...this.#slots].map(([slot, geometry]) => [slot, copyGeometry(geometry)])
    );
  }

  #mapped(
    transform: (geometry: UVGeometry, slot: UVSlot) => UVGeometry
  ): UVSlotMap {
    return new UVSlotMap(
      Object.fromEntries(
        [...this.#slots].map(([slot, geometry]) => [slot, transform(geometry, slot)])
      )
    );
  }
}
