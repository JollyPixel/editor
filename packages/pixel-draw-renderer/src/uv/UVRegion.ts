// Import Internal Dependencies
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import {
  copyGeometry,
  copyRect,
  rectOf
} from "./geometry.ts";
import { packNet } from "./netLayout.ts";
import { UVSlotMap } from "./UVSlotMap.ts";
import {
  DEFAULT_UV_SLOTS,
  type UVSlot,
  type UVGeometry,
  type UVRegionState
} from "./types.ts";

export type {
  UVRegionState,
  UVTriangleCorner,
  UVTriangle,
  UVCompound,
  UVCompoundPart,
  UVNormalizedRect,
  UVSlot,
  UVGeometry
} from "./types.ts";
export { DEFAULT_UV_SLOTS } from "./types.ts";

interface UVRegionIdentity {
  id: string;
  name?: string;
  color: string;
}

export type UVRegionData =
  | (UVRegionIdentity & {
    state: "stacked";
    rect: SelectionRect;
    faces?: Record<UVSlot, UVGeometry>;
    activeFaces?: UVSlot[];
    stackedFace?: UVSlot;
  })
  | (UVRegionIdentity & {
    state: "unfolded" | "free";
    faces: Record<UVSlot, UVGeometry>;
    activeFaces?: UVSlot[];
  });

export interface UVRegionSlot {
  slot: UVSlot | null;
  geometry: UVGeometry;
}

export type UVMovementScope = "region" | "slot";

type UVRegionLayout =
  | {
    state: "stacked";
    rect: SelectionRect;
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

function sameRect(
  a: SelectionRect,
  b: SelectionRect
): boolean {
  return a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height;
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

/**
 * Immutable region whose mutations return a new instance or `this` on no-op.
 */
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

  constructor(
    data: UVRegionData
  ) {
    this.id = data.id;
    this.name = data.name;
    this.color = data.color;

    if (data.state === "stacked") {
      this.#faces = data.faces ?
        new UVSlotMap(data.faces) :
        UVSlotMap.shared(data.rect);
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
      copyGeometry(this.#layout.rect) :
      this.#faces.get(slot);
  }

  slotsOf(): UVRegionSlot[] {
    if (this.#layout.state === "stacked") {
      return [
        {
          slot: null,
          geometry: copyRect(this.#layout.rect)
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
    const rect = rectOf(this.#faces.get(target));

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: "stacked",
      rect,
      faces: this.#faces.stackedAt(rect).toJSON(),
      activeFaces: [
        ...this.#activeFaces
      ],
      stackedFace: target
    });
  }

  free(): UVRegion {
    if (this.#layout.state === "free") {
      return this;
    }

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: "free",
      faces: this.#spreadFaces().toJSON(),
      activeFaces: [
        ...this.#activeFaces
      ]
    });
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

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: "unfolded",
      faces: spread.withSlots(packed).toJSON(),
      activeFaces: [
        ...this.#activeFaces
      ]
    });
  }

  withRect(
    rect: SelectionRect,
    slot?: UVSlot
  ): UVRegion {
    if (this.#layout.state === "stacked") {
      return new UVRegion({
        id: this.id,
        name: this.name,
        color: this.color,
        state: "stacked",
        rect,
        faces: this.#faces
          .translated(
            rect.x - this.#layout.rect.x,
            rect.y - this.#layout.rect.y
          )
          .toJSON(),
        activeFaces: [
          ...this.#activeFaces
        ],
        stackedFace: this.#layout.slot ?? undefined
      });
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
      copyRect(rect);

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: "free",
      faces: this.#faces.withSlot(slot, geometry).toJSON(),
      activeFaces: [
        ...this.#activeFaces
      ]
    });
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

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: layout.state,
      faces: this.#faces.translated(delta.x, delta.y).toJSON(),
      activeFaces: [
        ...this.#activeFaces
      ]
    });
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
      rect: copyRect(layout.rect)
    };
    const faces = this.#faces.slots;
    const hasTopology = this.#activeFaces.length !== faces.length ||
      faces.length !== DEFAULT_UV_SLOTS.length ||
      faces.some((face, index) => face !== DEFAULT_UV_SLOTS[index]) ||
      faces.some((face) => {
        const geometry = this.#faces.get(face);

        return !isRect(geometry) ||
          !sameRect(geometry, layout.rect);
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
