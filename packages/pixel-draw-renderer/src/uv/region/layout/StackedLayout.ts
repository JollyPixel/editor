// Import Internal Dependencies
import {
  copyRect,
  isRectGeometry,
  quarterTurn,
  rectOf,
  rotateGeometry,
  rotateRect,
  rotationOf,
  sameRect
} from "../../geometry/geometry.ts";
import { UVSlotMap } from "../UVSlotMap.ts";
import {
  UVLayout,
  type UVLayoutData,
  type UVMovementScope,
  type UVRegionSlot
} from "./UVLayout.ts";
import {
  UV_EVERY_RESIZE_HANDLE,
  type UVLayoutResizeTarget
} from "./UVResizeTarget.ts";
import {
  DEFAULT_UV_SLOTS,
  type UVGeometry,
  type UVQuarterTurn,
  type UVRect,
  type UVSlot
} from "../../geometry/types.ts";
import type {
  SelectionRect,
  Vec2
} from "../../../types.ts";

type StackedData = Extract<UVLayoutData, { state: "stacked"; }>;

export class StackedLayout extends UVLayout {
  readonly state = "stacked";
  readonly movementScope: UVMovementScope = "region";
  readonly #rect: SelectionRect;
  readonly #rotation: UVQuarterTurn;
  readonly #slot: UVSlot | null;

  static from(
    data: StackedData
  ): StackedLayout {
    const rotation = rotationOf(data.rect);
    const faces = data.faces ?
      new UVSlotMap(data.faces) :
      UVSlotMap.shared(StackedLayout.#rotated(data.rect, rotation));

    return new StackedLayout(
      faces,
      data.activeFaces ?? faces.slots,
      data.rect,
      data.stackedFace ?? null
    );
  }

  static stacking(
    layout: UVLayout,
    slot: UVSlot | null
  ): StackedLayout {
    const { faces, activeSlots } = layout;
    const target = StackedLayout.#target(layout, slot);
    const rotation = StackedLayout.#dominantRotation(
      activeSlots.map((face) => rotationOf(faces.get(face))),
      rotationOf(faces.get(target))
    );
    const aligned = faces.withSlots(
      new Map(
        faces.slots.map((face) => {
          const geometry = faces.get(face);

          return [face, rotateGeometry(geometry, rotation - rotationOf(geometry))];
        })
      )
    );
    const rect = rectOf(aligned.get(target));

    return new StackedLayout(
      aligned.stackedAt(rect),
      activeSlots,
      StackedLayout.#rotated(rect, rotation),
      target
    );
  }

  constructor(
    faces: UVSlotMap,
    activeSlots: readonly UVSlot[],
    rect: UVRect,
    slot: UVSlot | null
  ) {
    super(faces, activeSlots);
    if (slot !== null && !faces.has(slot)) {
      throw new RangeError(`Unknown stacked UV slot "${slot}"`);
    }

    this.#rect = copyRect(rect);
    this.#rotation = rotationOf(rect);
    this.#slot = slot;
  }

  override get stackedFace(): UVSlot | null {
    return this.#slot;
  }

  get bounds(): SelectionRect {
    return copyRect(this.#rect);
  }

  rectFor(): SelectionRect {
    return this.bounds;
  }

  geometryFor(): UVGeometry {
    return this.#geometry();
  }

  slotsOf(): UVRegionSlot[] {
    return [
      {
        slot: null,
        geometry: this.#geometry()
      }
    ];
  }

  spreadFaces(): UVSlotMap {
    const anchor = rectOf(
      this.faces.get(this.#slot ?? this.faces.slots[0])
    );

    return this.faces.translated(
      this.#rect.x - anchor.x,
      this.#rect.y - anchor.y
    );
  }

  translated(
    delta: Vec2
  ): StackedLayout {
    return this.movedTo(
      {
        x: this.#rect.x + delta.x,
        y: this.#rect.y + delta.y
      }
    );
  }

  movedTo(
    position: Vec2
  ): StackedLayout {
    const dx = position.x - this.#rect.x;
    const dy = position.y - this.#rect.y;
    if (dx === 0 && dy === 0) {
      return this;
    }

    return new StackedLayout(
      this.faces.translated(dx, dy),
      this.activeSlots,
      StackedLayout.#rotated({ ...this.#rect, x: position.x, y: position.y }, this.#rotation),
      this.#slot
    );
  }

  resized(
    rect: SelectionRect
  ): StackedLayout {
    if (sameRect(this.#rect, rect)) {
      return this;
    }

    const geometry = StackedLayout.#rotated(rect, this.#rotation);

    return new StackedLayout(
      UVSlotMap.shared(geometry, this.faces.slots),
      this.activeSlots,
      geometry,
      this.#slot
    );
  }

  rotated(
    turns: number
  ): StackedLayout {
    return new StackedLayout(
      this.faces.rotated(turns),
      this.activeSlots,
      StackedLayout.#rotated(
        rotateRect(this.#rect, turns),
        quarterTurn(this.#rotation + turns)
      ),
      this.#slot
    );
  }

  resizeTargets(): UVLayoutResizeTarget[] {
    return [
      {
        slot: null,
        rect: this.bounds,
        handles: UV_EVERY_RESIZE_HANDLE
      }
    ];
  }

  toJSON(): UVLayoutData {
    const data: StackedData = {
      state: "stacked",
      rect: this.#geometry()
    };
    if (this.#hasTopology()) {
      data.faces = this.faces.toJSON();
      data.activeFaces = [...this.activeSlots];
      if (this.#slot !== null) {
        data.stackedFace = this.#slot;
      }
    }

    return data;
  }

  #geometry(): UVRect {
    return StackedLayout.#rotated(this.#rect, this.#rotation);
  }

  #hasTopology(): boolean {
    const slots = this.faces.slots;

    return this.activeSlots.length !== slots.length ||
      slots.length !== DEFAULT_UV_SLOTS.length ||
      slots.some((slot, index) => slot !== DEFAULT_UV_SLOTS[index]) ||
      slots.some((slot) => {
        const geometry = this.faces.get(slot);

        return !isRectGeometry(geometry) ||
          !sameRect(geometry, this.#rect) ||
          rotationOf(geometry) !== this.#rotation;
      });
  }

  static #rotated(
    rect: SelectionRect,
    rotation: UVQuarterTurn
  ): UVRect {
    return rotation === 0 ?
      copyRect(rect) :
      {
        ...copyRect(rect),
        rotation
      };
  }

  static #target(
    layout: UVLayout,
    slot: UVSlot | null
  ): UVSlot {
    const largest = StackedLayout.#largestActiveSlots(layout);
    const rects = largest.filter(
      (candidate) => isRectGeometry(layout.faces.get(candidate))
    );
    const candidates = rects.length > 0 ? rects : largest;

    return slot !== null && candidates.includes(slot) ? slot : candidates[0];
  }

  static #largestActiveSlots(
    layout: UVLayout
  ): UVSlot[] {
    let best: UVSlot[] = [];
    let bestArea = -1;

    for (const slot of layout.activeSlots) {
      const rect = rectOf(layout.faces.get(slot));
      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = [slot];
        bestArea = area;
      }
      else if (area === bestArea) {
        best.push(slot);
      }
    }

    return best;
  }

  static #dominantRotation(
    rotations: readonly UVQuarterTurn[],
    preferred: UVQuarterTurn
  ): UVQuarterTurn {
    const counts = new Map<UVQuarterTurn, number>();
    for (const rotation of rotations) {
      counts.set(rotation, (counts.get(rotation) ?? 0) + 1);
    }

    const best = Math.max(...counts.values());
    if ((counts.get(preferred) ?? 0) === best) {
      return preferred;
    }

    return rotations.find((rotation) => counts.get(rotation) === best) ?? preferred;
  }
}
