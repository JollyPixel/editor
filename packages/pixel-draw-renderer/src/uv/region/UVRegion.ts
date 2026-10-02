// Import Internal Dependencies
import type {
  RotationDirection,
  SelectionRect,
  Vec2
} from "../../types.ts";
import {
  copyRect,
  geometryAt,
  quarterTurn,
  quarterTurnsOf,
  rectOf,
  rotateGeometry,
  rotateRect,
  rotationOf,
  sameRect,
  withRotation
} from "../geometry/geometry.ts";
import { packNet } from "./netLayout.ts";
import {
  alignedResizes,
  slidNeighbors,
  withEdgeMoved
} from "./netSlide.ts";
import { UVSlotMap } from "./UVSlotMap.ts";
import {
  DEFAULT_UV_SLOTS,
  type UVSlot,
  type UVGeometry,
  type UVQuarterTurn,
  type UVRect,
  type UVRegionState
} from "../geometry/types.ts";

export type {
  UVQuarterTurn,
  UVRect,
  UVRegionState,
  UVTriangleCorner,
  UVTriangle,
  UVCompound,
  UVCompoundPart,
  UVNormalizedRect,
  UVSlot,
  UVGeometry
} from "../geometry/types.ts";
export { DEFAULT_UV_SLOTS } from "../geometry/types.ts";

export interface UVRegionIdentity {
  id: string;
  name?: string;
  color: string;
}

type WithoutIdentity<TRegion> = TRegion extends unknown ?
  Omit<TRegion, keyof UVRegionIdentity> :
  never;

export type UVRegionData =
  | (UVRegionIdentity & {
    state: "stacked";
    rect: UVRect;
    faces?: Record<UVSlot, UVGeometry>;
    activeFaces?: UVSlot[];
    stackedFace?: UVSlot;
  })
  | (UVRegionIdentity & {
    state: "unfolded" | "free";
    faces: Record<UVSlot, UVGeometry>;
    activeFaces?: UVSlot[];
  });

export type UVLayoutData = WithoutIdentity<UVRegionData>;

export interface UVResizeOptions {
  aligned?: boolean;
}

export interface UVRegionSlot {
  slot: UVSlot | null;
  geometry: UVGeometry;
}

export type UVMovementScope = "region" | "slot";

type UVRegionLayout =
  | {
    state: "stacked";
    rect: SelectionRect;
    rotation: UVQuarterTurn;
    slot: UVSlot | null;
  }
  | {
    state: "unfolded" | "free";
  };

function normalizeActiveFaces(
  activeFaces: readonly UVSlot[],
  faces: UVSlotMap
): readonly UVSlot[] {
  const seen = new Set<UVSlot>();

  return activeFaces.filter(
    (face) => faces.has(face) && !seen.has(face) && seen.add(face) !== undefined
  );
}

function isRect(
  geometry: UVGeometry
): geometry is SelectionRect {
  return !("shape" in geometry);
}

function unionOf(
  rects: readonly SelectionRect[]
): SelectionRect {
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function rotatedRect(
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

function dominantRotation(
  rotations: readonly UVQuarterTurn[],
  preferred: UVQuarterTurn
): UVQuarterTurn {
  const counts = new Map<UVQuarterTurn, number>();
  for (const rotation of rotations) {
    counts.set(rotation, (counts.get(rotation) ?? 0) + 1);
  }

  const best = Math.max(0, ...counts.values());
  if ((counts.get(preferred) ?? 0) === best) {
    return preferred;
  }

  return rotations.find((rotation) => counts.get(rotation) === best) ??
    preferred;
}

export class UVRegion {
  readonly id: string;
  readonly name?: string;
  readonly color: string;
  readonly #faces: UVSlotMap;
  readonly #activeFaces: readonly UVSlot[];
  readonly #layout: UVRegionLayout;

  static from(
    value: UVRegion | UVRegionData
  ): UVRegion {
    return value instanceof UVRegion ? value : new UVRegion(value);
  }

  static fromLayout(
    layout: UVLayoutData,
    identity: UVRegionIdentity
  ): UVRegion {
    return new UVRegion({
      ...layout,
      ...identity
    });
  }

  constructor(
    data: UVRegionData
  ) {
    this.id = data.id;
    this.name = data.name;
    this.color = data.color;

    if (data.state === "stacked") {
      const rotation = rotationOf(data.rect);
      this.#faces = data.faces ?
        new UVSlotMap(data.faces) :
        UVSlotMap.shared(rotatedRect(data.rect, rotation));
      if (
        data.stackedFace !== undefined &&
        !this.#faces.has(data.stackedFace)
      ) {
        throw new RangeError(
          `Unknown stacked UV slot "${data.stackedFace}"`
        );
      }
      this.#layout = {
        state: "stacked",
        rect: copyRect(data.rect),
        rotation,
        slot: data.stackedFace ?? null
      };
    }
    else {
      this.#faces = new UVSlotMap(data.faces);
      this.#layout = {
        state: data.state
      };
    }

    this.#activeFaces = normalizeActiveFaces(
      data.activeFaces ?? this.#faces.slots,
      this.#faces
    );
  }

  get slots(): readonly UVSlot[] {
    return this.#faces.slots;
  }

  get activeSlots(): readonly UVSlot[] {
    return [...this.#activeFaces];
  }

  get movementScope(): UVMovementScope {
    return this.#layout.state === "free" ? "slot" : "region";
  }

  get state(): UVRegionState {
    return this.#layout.state;
  }

  get resizable(): boolean {
    return this.#faces.slots.every(
      (face) => isRect(this.#faces.get(face))
    );
  }

  get stackedFace(): UVSlot | null {
    return this.#layout.state === "stacked" ?
      this.#layout.slot :
      null;
  }

  get bounds(): SelectionRect {
    if (this.#layout.state === "stacked") {
      return copyRect(this.#layout.rect);
    }

    return unionOf(
      this.#renderedFaces().map(
        (face) => rectOf(this.#faces.get(face))
      )
    );
  }

  rectFor(
    slot: UVSlot
  ): SelectionRect {
    if (this.state !== "free") {
      return this.bounds;
    }

    return rectOf(this.#faces.get(slot));
  }

  geometryFor(
    slot: UVSlot
  ): UVGeometry {
    return this.#layout.state === "stacked" ?
      rotatedRect(this.#layout.rect, this.#layout.rotation) :
      this.#faces.get(slot);
  }

  slotsOf(): UVRegionSlot[] {
    if (this.#layout.state === "stacked") {
      return [
        {
          slot: null,
          geometry: rotatedRect(this.#layout.rect, this.#layout.rotation)
        }
      ];
    }

    return this.#activeFaces.map((face) => {
      return {
        slot: face,
        geometry: this.#faces.get(face)
      };
    });
  }

  stack(
    slot?: UVSlot
  ): UVRegion {
    if (this.#layout.state === "stacked") {
      return this;
    }

    const target = this.#stackTarget(slot);
    const rotation = dominantRotation(
      this.#renderedFaces().map(
        (face) => rotationOf(this.#faces.get(face))
      ),
      rotationOf(this.#faces.get(target))
    );
    const faces = this.#faces.withSlots(
      new Map(
        this.#faces.slots.map((face) => {
          const geometry = this.#faces.get(face);

          return [
            face,
            rotateGeometry(geometry, rotation - rotationOf(geometry))
          ];
        })
      )
    );
    const rect = rectOf(faces.get(target));

    return this.#stackedWith(
      rotatedRect(rect, rotation),
      faces.stackedAt(rect),
      target
    );
  }

  renamed(
    name: string
  ): UVRegion {
    if (this.name === name) {
      return this;
    }

    return new UVRegion({
      ...this.toJSON(),
      name
    });
  }

  free(): UVRegion {
    if (this.#layout.state === "free") {
      return this;
    }

    return this.#spreadWith("free", this.#spreadFaces());
  }

  unfold(): UVRegion {
    if (this.#layout.state === "unfolded") {
      return this;
    }

    const spread = this.#spreadFaces();
    const origin = this.bounds;
    const packed = packNet(
      this.#renderedFaces().map((face) => {
        return {
          face,
          geometry: spread.get(face)
        };
      }),
      origin
    );

    return this.#spreadWith("unfolded", spread.withSlots(packed));
  }

  withRect(
    rect: SelectionRect,
    slot?: UVSlot
  ): UVRegion {
    if (this.#layout.state === "stacked") {
      return this.#stackedWith(
        rotatedRect(rect, this.#layout.rotation),
        this.#faces.translated(
          rect.x - this.#layout.rect.x,
          rect.y - this.#layout.rect.y
        ),
        this.#layout.slot
      );
    }

    if (this.#layout.state === "unfolded") {
      const bounds = this.bounds;

      return this.translated({
        x: rect.x - bounds.x,
        y: rect.y - bounds.y
      });
    }

    if (!slot) {
      return this;
    }

    const previous = this.#faces.get(slot);
    const geometry = "shape" in previous ?
      { ...previous, rect: copyRect(rect) } :
      withRotation(copyRect(rect), rotationOf(previous));

    return this.#spreadWith("free", this.#faces.withSlot(slot, geometry));
  }

  translated(
    delta: Vec2
  ): UVRegion {
    if (delta.x === 0 && delta.y === 0) {
      return this;
    }

    const layout = this.#layout;
    if (layout.state === "stacked") {
      return this.withRect({
        ...layout.rect,
        x: layout.rect.x + delta.x,
        y: layout.rect.y + delta.y
      });
    }

    return this.#spreadWith(
      layout.state,
      this.#faces.translated(delta.x, delta.y)
    );
  }

  resized(
    rect: SelectionRect,
    slot?: UVSlot,
    options: UVResizeOptions = {}
  ): UVRegion {
    if (rect.width < 1 || rect.height < 1) {
      throw new RangeError("UV resize needs a size of at least 1px");
    }
    if (!this.resizable) {
      return this;
    }

    const layout = this.#layout;
    if (layout.state === "stacked") {
      if (sameRect(layout.rect, rect)) {
        return this;
      }
      const geometry = rotatedRect(rect, layout.rotation);

      return this.#stackedWith(
        geometry,
        UVSlotMap.shared(geometry, this.#faces.slots),
        layout.slot
      );
    }

    if (slot === undefined || !this.#activeFaces.includes(slot)) {
      return this;
    }

    const previous = rectOf(this.#faces.get(slot));
    if (sameRect(previous, rect)) {
      return this;
    }
    if (options.aligned && layout.state === "unfolded") {
      return alignedResizes(
        this.#faces,
        this.#activeFaces,
        slot,
        previous,
        rect
      ).reduce(
        (region, { slot: face, edge, delta }) => region.resized(
          withEdgeMoved(rectOf(region.#faces.get(face)), edge, delta),
          face
        ),
        this.resized(rect, slot)
      );
    }

    const faces = layout.state === "free" ?
      this.#faces.withSlot(
        slot,
        geometryAt(this.#faces.get(slot), rect)
      ) :
      this.#faces.withSlots(
        slidNeighbors(
          this.#faces,
          this.#activeFaces,
          slot,
          previous,
          rect
        ).set(slot, geometryAt(this.#faces.get(slot), rect))
      );

    return this.#spreadWith(layout.state, faces);
  }

  withGeometry(
    slot: UVSlot,
    geometry: UVGeometry
  ): UVRegion {
    if (this.#layout.state !== "free" || !this.#faces.has(slot)) {
      return this;
    }

    return this.#spreadWith("free", this.#faces.withSlot(slot, geometry));
  }

  rotated(
    direction: RotationDirection,
    slot?: UVSlot
  ): UVRegion {
    const turns = quarterTurnsOf(direction);
    const layout = this.#layout;
    if (layout.state === "stacked") {
      const rect = rotateRect(layout.rect, turns);

      return this.#stackedWith(
        rotatedRect(rect, quarterTurn(layout.rotation + turns)),
        this.#faces.rotated(turns),
        layout.slot
      );
    }

    let faces: UVSlotMap;
    if (layout.state === "unfolded") {
      faces = this.#faces.rotatedWithin(this.bounds, turns);
    }
    else if (slot !== undefined && this.#faces.has(slot)) {
      faces = this.#faces.rotated(turns, [slot]);
    }
    else {
      return this;
    }

    return this.#spreadWith(layout.state, faces);
  }

  toLayout(): UVLayoutData {
    const {
      id: _id,
      name: _name,
      color: _color,
      ...layout
    } = this.toJSON();

    return layout;
  }

  toJSON(): UVRegionData {
    const identity: UVRegionIdentity = {
      id: this.id,
      color: this.color
    };
    if (this.name !== undefined) {
      identity.name = this.name;
    }

    const layout = this.#layout;
    if (layout.state !== "stacked") {
      return {
        ...identity,
        state: layout.state,
        faces: this.#faces.toJSON(),
        activeFaces: [
          ...this.#activeFaces
        ]
      };
    }

    const data: UVRegionData = {
      ...identity,
      state: "stacked",
      rect: rotatedRect(layout.rect, layout.rotation)
    };
    const faces = this.#faces.slots;
    const hasTopology = this.#activeFaces.length !== faces.length ||
      faces.length !== DEFAULT_UV_SLOTS.length ||
      faces.some((face, index) => face !== DEFAULT_UV_SLOTS[index]) ||
      faces.some((face) => {
        const geometry = this.#faces.get(face);

        return !isRect(geometry) ||
          !sameRect(geometry, layout.rect) ||
          rotationOf(geometry) !== layout.rotation;
      });
    if (hasTopology) {
      data.faces = this.#faces.toJSON();
      data.activeFaces = [
        ...this.#activeFaces
      ];
      if (layout.slot !== null) {
        data.stackedFace = layout.slot;
      }
    }

    return data;
  }

  #stackedWith(
    rect: UVRect,
    faces: UVSlotMap,
    slot: UVSlot | null
  ): UVRegion {
    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: "stacked",
      rect,
      faces: faces.toJSON(),
      activeFaces: [
        ...this.#activeFaces
      ],
      stackedFace: slot ?? undefined
    });
  }

  #spreadWith(
    state: "unfolded" | "free",
    faces: UVSlotMap
  ): UVRegion {
    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state,
      faces: faces.toJSON(),
      activeFaces: [
        ...this.#activeFaces
      ]
    });
  }

  #renderedFaces(): readonly UVSlot[] {
    return this.#activeFaces.length > 0 ?
      this.#activeFaces :
      [this.#faces.primarySlot];
  }

  #spreadFaces(): UVSlotMap {
    const layout = this.#layout;
    if (layout.state !== "stacked") {
      return this.#faces;
    }

    const anchor = rectOf(
      this.#faces.get(layout.slot ?? this.#faces.primarySlot)
    );

    return this.#faces.translated(
      layout.rect.x - anchor.x,
      layout.rect.y - anchor.y
    );
  }

  #stackTarget(
    face: UVSlot | undefined
  ): UVSlot {
    const largest = this.#largestActiveFaces();
    const rects = largest.filter(
      (candidate) => isRect(this.#faces.get(candidate))
    );
    const candidates = rects.length > 0 ? rects : largest;

    return (face !== undefined && candidates.includes(face) ? face : candidates[0]) ??
      face ??
      this.#faces.primarySlot;
  }

  #largestActiveFaces(): UVSlot[] {
    let best: UVSlot[] = [];
    let bestArea = -1;

    for (const face of this.#activeFaces) {
      const rect = rectOf(this.#faces.get(face));
      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = [face];
        bestArea = area;
      }
      else if (area === bestArea) {
        best.push(face);
      }
    }

    return best;
  }
}
