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
  DEFAULT_UV_SLOTS,
  type UVSlot,
  type UVGeometry
} from "./types.ts";

export class UVSlotMap {
  readonly #slots: Map<UVSlot, UVGeometry>;

  static map<T>(
    fn: (face: UVSlot) => T,
    faces: readonly UVSlot[] = DEFAULT_UV_SLOTS
  ): Record<UVSlot, T> {
    return Object.fromEntries(
      faces.map((face) => [face, fn(face)])
    );
  }

  static shared(
    rect: SelectionRect,
    faces: readonly UVSlot[] = DEFAULT_UV_SLOTS
  ): UVSlotMap {
    return new UVSlotMap(
      UVSlotMap.map(() => rect, faces)
    );
  }

  constructor(
    slots: Record<UVSlot, UVGeometry>
  ) {
    const names = Object.keys(slots);
    if (names.length === 0) {
      throw new RangeError("A UV slot map must contain at least one slot");
    }

    this.#slots = new Map(
      names.map(
        (slot) => [slot, copyGeometry(slots[slot])]
      )
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

  get primarySlot(): UVSlot {
    return this.#slots.keys().next().value!;
  }

  withSlot(
    slot: UVSlot,
    geometry: UVGeometry
  ): UVSlotMap {
    if (!this.#slots.has(slot)) {
      throw new RangeError(`Unknown UV slot "${slot}"`);
    }

    return new UVSlotMap(
      UVSlotMap.map(
        (mapSlot) => (
          mapSlot === slot ? geometry : this.#slots.get(mapSlot)!
        ),
        this.slots
      )
    );
  }

  withSlots(
    entries: ReadonlyMap<UVSlot, UVGeometry>
  ): UVSlotMap {
    return new UVSlotMap(
      UVSlotMap.map(
        (slot) => entries.get(slot) ?? this.#slots.get(slot)!,
        this.slots
      )
    );
  }

  stackedAt(
    origin: Vec2
  ): UVSlotMap {
    return new UVSlotMap(
      UVSlotMap.map(
        (slot) => {
          const geometry = this.#slots.get(slot)!;

          return geometryAt(geometry, {
            ...rectOf(geometry),
            x: origin.x,
            y: origin.y
          });
        },
        this.slots
      )
    );
  }

  translated(
    dx: number,
    dy: number
  ): UVSlotMap {
    return new UVSlotMap(
      UVSlotMap.map(
        (slot) => {
          const geometry = this.#slots.get(slot)!;
          const rect = rectOf(geometry);

          return geometryAt(geometry, {
            ...rect,
            x: rect.x + dx,
            y: rect.y + dy
          });
        },
        this.slots
      )
    );
  }

  toJSON(): Record<UVSlot, UVGeometry> {
    return UVSlotMap.map(
      (slot) => copyGeometry(this.#slots.get(slot)!),
      this.slots
    );
  }
}
