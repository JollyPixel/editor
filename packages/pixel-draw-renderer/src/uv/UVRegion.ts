// Import Internal Dependencies
import type {
  SelectionRect
} from "../types.ts";
import {
  copyGeometry,
  copyRect,
  rectOf
} from "./geometry.ts";
import { UVFaceMap } from "./UVFaceMap.ts";
import {
  UV_FACES,
  type UVFace,
  type UVGeometry,
  type UVRegionState
} from "./types.ts";

export type {
  UVFace,
  UVRegionState,
  UVTriangleCorner,
  UVTriangle,
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
    state?: "collapsed";
    rect: SelectionRect;
    faces?: Record<UVFace, UVGeometry>;
    activeFaces?: UVFace[];
    collapsedFace?: UVFace;
  })
  | (UVRegionIdentity & {
    state: "uncollapsed";
    faces: Record<UVFace, UVGeometry>;
    activeFaces?: UVFace[];
  });

export interface UVRegionFace {
  face: UVFace | null;
  geometry: UVGeometry;
}

function normalizeActiveFaces(
  activeFaces: readonly UVFace[]
): readonly UVFace[] {
  return UV_FACES.filter((face) => activeFaces.includes(face));
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

/**
 * Immutable region whose mutations return a new instance or `this` on no-op.
 */
export class UVRegion {
  readonly id: string;
  readonly name?: string;
  readonly color: string;
  readonly state: UVRegionState;
  readonly #faces: UVFaceMap;
  readonly #activeFaces: readonly UVFace[];
  readonly #collapsedRect: SelectionRect | null;
  readonly #collapsedFace: UVFace | null;

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

    if (data.state === "uncollapsed") {
      this.state = "uncollapsed";
      this.#faces = new UVFaceMap(data.faces);
      this.#activeFaces = normalizeActiveFaces(
        data.activeFaces ?? UV_FACES
      );
      this.#collapsedRect = null;
      this.#collapsedFace = null;
    }
    else {
      this.state = "collapsed";
      this.#faces = data.faces ?
        new UVFaceMap(data.faces) :
        UVFaceMap.shared(data.rect);
      this.#activeFaces = normalizeActiveFaces(
        data.activeFaces ?? UV_FACES
      );
      this.#collapsedRect = copyRect(data.rect);
      this.#collapsedFace = data.collapsedFace ?? null;
    }
  }

  get collapsedFace(): UVFace | null {
    return this.#collapsedFace;
  }

  rectFor(
    face: UVFace
  ): SelectionRect {
    if (this.#collapsedRect) {
      return copyRect(this.#collapsedRect);
    }

    return rectOf(this.#faces.get(face));
  }

  geometryFor(
    face: UVFace
  ): UVGeometry {
    return this.#collapsedRect ?
      copyGeometry(this.#collapsedRect) :
      this.#faces.get(face);
  }

  facesOf(): UVRegionFace[] {
    if (this.state === "collapsed") {
      return [
        {
          face: null,
          geometry: copyRect(
            this.#collapsedRect!
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

  collapse(
    face?: UVFace
  ): UVRegion {
    if (this.state === "collapsed") {
      return this;
    }

    const target = this.#collapseTarget(face);

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: "collapsed",
      rect: rectOf(this.#faces.get(target)),
      faces: this.#faces.toJSON(),
      activeFaces: [
        ...this.#activeFaces
      ],
      collapsedFace: target
    });
  }

  uncollapse(): UVRegion {
    if (this.state === "uncollapsed") {
      return this;
    }

    const anchor = rectOf(
      this.#faces.get(this.#collapsedFace ?? "front")
    );

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: "uncollapsed",
      faces: this.#faces
        .translated(
          this.#collapsedRect!.x - anchor.x,
          this.#collapsedRect!.y - anchor.y
        )
        .toJSON(),
      activeFaces: [
        ...this.#activeFaces
      ]
    });
  }

  #collapseTarget(
    face: UVFace | undefined
  ): UVFace {
    const requested = face ?? this.#largestActiveFace();
    if (!("shape" in this.#faces.get(requested))) {
      return requested;
    }

    return this.#activeFaces.find(
      (activeFace) => !("shape" in this.#faces.get(activeFace))
    ) ?? requested;
  }

  #largestActiveFace(): UVFace {
    let best: UVFace = this.#activeFaces[0] ?? "front";
    let bestArea = -1;

    for (const face of this.#activeFaces) {
      const rect = rectOf(this.#faces.get(face));
      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = face;
        bestArea = area;
      }
    }

    return best;
  }

  withRect(
    rect: SelectionRect,
    face?: UVFace
  ): UVRegion {
    if (this.state === "collapsed") {
      return new UVRegion({
        id: this.id,
        name: this.name,
        color: this.color,
        state: "collapsed",
        rect,
        faces: this.#faces
          .translated(
            rect.x - this.#collapsedRect!.x,
            rect.y - this.#collapsedRect!.y
          )
          .toJSON(),
        activeFaces: [
          ...this.#activeFaces
        ],
        collapsedFace: this.#collapsedFace ?? undefined
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
      state: "uncollapsed",
      faces: this.#faces.withFace(face, geometry).toJSON(),
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

    if (this.state === "uncollapsed") {
      return {
        ...identity,
        state: "uncollapsed",
        faces: this.#faces.toJSON(),
        activeFaces: [
          ...this.#activeFaces
        ]
      };
    }

    const data: UVRegionData = {
      ...identity,
      state: "collapsed",
      rect: copyRect(this.#collapsedRect!)
    };
    const hasTopology = this.#activeFaces.length !== UV_FACES.length ||
      UV_FACES.some((face) => {
        const geometry = this.#faces.get(face);

        return "shape" in geometry ||
          !sameRect(geometry, this.#collapsedRect!);
      });
    if (hasTopology) {
      data.faces = this.#faces.toJSON();
      data.activeFaces = [
        ...this.#activeFaces
      ];
      if (this.#collapsedFace !== null) {
        data.collapsedFace = this.#collapsedFace;
      }
    }

    return data;
  }
}
