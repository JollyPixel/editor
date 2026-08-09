// Import Internal Dependencies
import type {
  SelectionRect
} from "../types.ts";
import {
  copyGeometry,
  copyRect,
  geometryAt,
  rectOf
} from "./geometry.ts";

export type UVFace =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom";

export type UVRegionState =
  | "collapsed"
  | "uncollapsed";

/**
 * The corner containing the triangle's right angle.
 */
export type UVTriangleCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/**
 * A triangular UV occupies three corners of its bounding rect. Keeping the
 * bounds separate lets all existing move and clamp paths stay rect-based.
 */
export interface UVTriangle {
  shape: "triangle";
  rect: SelectionRect;
  corner: UVTriangleCorner;
}

export type UVGeometry = SelectionRect | UVTriangle;

export const UV_FACES: readonly UVFace[] = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom"
];

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

function copyFaces(
  faces: Record<UVFace, UVGeometry>
): Record<UVFace, UVGeometry> {
  return {
    front: copyGeometry(faces.front),
    back: copyGeometry(faces.back),
    left: copyGeometry(faces.left),
    right: copyGeometry(faces.right),
    top: copyGeometry(faces.top),
    bottom: copyGeometry(faces.bottom)
  };
}

function normalizeActiveFaces(
  activeFaces: readonly UVFace[]
): readonly UVFace[] {
  return UV_FACES.filter((face) => activeFaces.includes(face));
}

function sharedFaces(
  rect: SelectionRect
): Record<UVFace, UVGeometry> {
  return {
    front: copyRect(rect),
    back: copyRect(rect),
    left: copyRect(rect),
    right: copyRect(rect),
    top: copyRect(rect),
    bottom: copyRect(rect)
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
  readonly #faces: Record<UVFace, UVGeometry>;
  readonly #activeFaces: readonly UVFace[];
  readonly #collapsedRect: SelectionRect | null;

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
      this.#faces = copyFaces(data.faces);
      this.#activeFaces = normalizeActiveFaces(
        data.activeFaces ?? UV_FACES
      );
      this.#collapsedRect = null;
    }
    else {
      this.state = "collapsed";
      this.#faces = data.faces ?
        copyFaces(data.faces) :
        sharedFaces(data.rect);
      this.#activeFaces = normalizeActiveFaces(
        data.activeFaces ?? UV_FACES
      );
      this.#collapsedRect = copyRect(data.rect);
    }
  }

  rectFor(
    face: UVFace
  ): SelectionRect {
    if (this.#collapsedRect) {
      return copyRect(this.#collapsedRect);
    }

    return rectOf(this.#faces[face]);
  }

  geometryFor(
    face: UVFace
  ): UVGeometry {
    return copyGeometry(
      this.#collapsedRect ?? this.#faces[face]
    );
  }

  facesOf(): UVRegionFace[] {
    if (this.state === "collapsed") {
      return [
        {
          face: null,
          geometry: copyRect(this.#collapsedRect!)
        }
      ];
    }

    return this.#activeFaces.map((face) => {
      return {
        face,
        geometry: copyGeometry(this.#faces[face])
      };
    });
  }

  collapse(
    face: UVFace = "front"
  ): UVRegion {
    if (this.state === "collapsed") {
      return this;
    }

    const preferred = this.#faces[face];
    const geometry = "shape" in preferred ?
      this.#activeFaces
        .map((activeFace) => this.#faces[activeFace])
        .find((value) => !("shape" in value)) ?? preferred :
      preferred;

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: "collapsed",
      rect: rectOf(geometry),
      faces: copyFaces(this.#faces),
      activeFaces: [...this.#activeFaces]
    });
  }

  uncollapse(): UVRegion {
    if (this.state === "uncollapsed") {
      return this;
    }

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: "uncollapsed",
      faces: this.#facesAt(this.#collapsedRect!),
      activeFaces: [...this.#activeFaces]
    });
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
        faces: copyFaces(this.#faces),
        activeFaces: [...this.#activeFaces]
      });
    }

    if (!face) {
      return this;
    }

    const faces = copyFaces(this.#faces);
    const previous = faces[face];
    faces[face] = "shape" in previous ?
      { ...previous, rect: copyRect(rect) } :
      copyRect(rect);

    return new UVRegion({
      id: this.id,
      name: this.name,
      color: this.color,
      state: "uncollapsed",
      faces,
      activeFaces: [...this.#activeFaces]
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
        faces: copyFaces(this.#faces),
        activeFaces: [...this.#activeFaces]
      };
    }

    const data: UVRegionData = {
      ...identity,
      state: "collapsed",
      rect: copyRect(this.#collapsedRect!)
    };
    const hasTopology = this.#activeFaces.length !== UV_FACES.length ||
      UV_FACES.some((face) => "shape" in this.#faces[face]);
    if (hasTopology) {
      data.faces = copyFaces(this.#faces);
      data.activeFaces = [...this.#activeFaces];
    }

    return data;
  }

  #facesAt(
    rect: SelectionRect
  ): Record<UVFace, UVGeometry> {
    return {
      front: geometryAt(this.#faces.front, rect),
      back: geometryAt(this.#faces.back, rect),
      left: geometryAt(this.#faces.left, rect),
      right: geometryAt(this.#faces.right, rect),
      top: geometryAt(this.#faces.top, rect),
      bottom: geometryAt(this.#faces.bottom, rect)
    };
  }
}
