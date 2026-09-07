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
  UV_FACES,
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
export { UV_FACES } from "./types.ts";

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

export interface UVRegionFace {
  face: UVSlot | null;
  geometry: UVGeometry;
}

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
): boolean {
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
  readonly state: UVRegionState;
  readonly #faces: UVSlotMap;
  readonly #activeFaces: readonly UVSlot[];
  readonly #stackedRect: SelectionRect | null;
  readonly #stackedFace: UVSlot | null;

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
      this.state = "stacked";
      this.#faces = data.faces ?
        new UVSlotMap(data.faces) :
        UVSlotMap.shared(data.rect);
      this.#stackedRect = copyRect(data.rect);
      this.#stackedFace = data.stackedFace ?? null;
    }
    else {
      this.state = data.state;
      this.#faces = new UVSlotMap(data.faces);
      this.#stackedRect = null;
      this.#stackedFace = null;
    }

    this.#activeFaces = normalizeActiveFaces(
      data.activeFaces ?? this.#faces.faces,
      this.#faces
    );
  }

  get faces(): readonly UVSlot[] {
    return this.#faces.faces;
  }

  get stackedFace(): UVSlot | null {
    return this.#stackedFace;
  }

  get bounds(): SelectionRect {
    if (this.#stackedRect) {
      return copyRect(this.#stackedRect);
    }

    return unionOf(
      this.#renderedFaces().map(
        (face) => rectOf(this.#faces.get(face))
      )
    );
  }

  rectFor(
    face: UVSlot
  ): SelectionRect {
    if (this.state !== "free") {
      return this.bounds;
    }

    return rectOf(this.#faces.get(face));
  }

  geometryFor(
    face: UVSlot
  ): UVGeometry {
    return this.#stackedRect ?
      copyGeometry(this.#stackedRect) :
      this.#faces.get(face);
  }

  facesOf(): UVRegionFace[] {
    if (this.state === "stacked") {
      return [
        {
          face: null,
          geometry: copyRect(
            this.#stackedRect!
          )
        }
      ];
    }

    return this.#activeFaces.map((face) => {
      return {
        face,
        geometry: this.#faces.get(face)
      };
    });
  }

  stack(
    face?: UVSlot
  ): UVRegion {
    if (this.state === "stacked") {
      return this;
    }

    const target = this.#stackTarget(face);
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
    if (this.state === "free") {
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
    if (this.state === "unfolded") {
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
      faces: spread.withFaces(packed).toJSON(),
      activeFaces: [
        ...this.#activeFaces
      ]
    });
  }

  withRect(
    rect: SelectionRect,
    face?: UVSlot
  ): UVRegion {
    if (this.state === "stacked") {
      return new UVRegion({
        id: this.id,
        name: this.name,
        color: this.color,
        state: "stacked",
        rect,
        faces: this.#faces
          .translated(
            rect.x - this.#stackedRect!.x,
            rect.y - this.#stackedRect!.y
          )
          .toJSON(),
        activeFaces: [
          ...this.#activeFaces
        ],
        stackedFace: this.#stackedFace ?? undefined
      });
    }

    if (this.state === "unfolded") {
      const bounds = this.bounds;

      return this.translated({
        x: rect.x - bounds.x,
        y: rect.y - bounds.y
      });
    }

    if (!face) {
      return this;
    }

    const previous = this.#faces.get(face);
    const geometry = "shape" in previous ?
      { ...previous, rect: copyRect(rect) } :
      copyRect(rect);

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: "free",
      faces: this.#faces.withFace(face, geometry).toJSON(),
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

    if (this.state === "stacked") {
      return this.withRect({
        ...this.#stackedRect!,
        x: this.#stackedRect!.x + delta.x,
        y: this.#stackedRect!.y + delta.y
      });
    }

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: this.state,
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

    if (this.state !== "stacked") {
      return {
        ...identity,
        state: this.state,
        faces: this.#faces.toJSON(),
        activeFaces: [
          ...this.#activeFaces
        ]
      };
    }

    const data: UVRegionData = {
      ...identity,
      state: "stacked",
      rect: copyRect(this.#stackedRect!)
    };
    const faces = this.#faces.faces;
    const hasTopology = this.#activeFaces.length !== faces.length ||
      faces.length !== UV_FACES.length ||
      faces.some((face, index) => face !== UV_FACES[index]) ||
      faces.some((face) => {
        const geometry = this.#faces.get(face);

        return !isRect(geometry) ||
          !sameRect(geometry as SelectionRect, this.#stackedRect!);
      });
    if (hasTopology) {
      data.faces = this.#faces.toJSON();
      data.activeFaces = [
        ...this.#activeFaces
      ];
      if (this.#stackedFace !== null) {
        data.stackedFace = this.#stackedFace;
      }
    }

    return data;
  }

  #renderedFaces(): readonly UVSlot[] {
    return this.#activeFaces.length > 0 ?
      this.#activeFaces :
      [this.#faces.primaryFace];
  }

  #spreadFaces(): UVSlotMap {
    if (this.state !== "stacked") {
      return this.#faces;
    }

    const anchor = rectOf(
      this.#faces.get(this.#stackedFace ?? this.#faces.primaryFace)
    );

    return this.#faces.translated(
      this.#stackedRect!.x - anchor.x,
      this.#stackedRect!.y - anchor.y
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
      this.#faces.primaryFace;
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
