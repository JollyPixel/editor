// Import Internal Dependencies
import type {
  SelectionRect
} from "../types.ts";

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
  color: string;
}

export type UVRegionData =
  | (UVRegionIdentity & { state?: "collapsed"; rect: SelectionRect; })
  | (UVRegionIdentity & { state: "uncollapsed"; faces: Record<UVFace, SelectionRect>; });

export interface UVRegionFace {
  face: UVFace | null;
  rect: SelectionRect;
}

function copyRect(
  rect: SelectionRect
): SelectionRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

function copyFaces(
  faces: Record<UVFace, SelectionRect>
): Record<UVFace, SelectionRect> {
  return {
    front: copyRect(faces.front),
    back: copyRect(faces.back),
    left: copyRect(faces.left),
    right: copyRect(faces.right),
    top: copyRect(faces.top),
    bottom: copyRect(faces.bottom)
  };
}

/**
 * Shares one rect across all faces (regions never mutate rects in place).
 */
function sharedFaces(
  rect: SelectionRect
): Record<UVFace, SelectionRect> {
  const shared = copyRect(rect);

  return {
    front: shared,
    back: shared,
    left: shared,
    right: shared,
    top: shared,
    bottom: shared
  };
}

/**
 * Immutable texture region: collapsed (one rect for all faces) or uncollapsed (per-face).
 * All mutations return a new instance or `this` on no-op.
 */
export class UVRegion {
  readonly id: string;
  readonly color: string;
  readonly state: UVRegionState;
  readonly #faces: Record<UVFace, SelectionRect>;

  static from(
    value: UVRegion | UVRegionData
  ): UVRegion {
    return value instanceof UVRegion ? value : new UVRegion(value);
  }

  constructor(
    data: UVRegionData
  ) {
    this.id = data.id;
    this.color = data.color;

    if (data.state === "uncollapsed") {
      this.state = "uncollapsed";
      this.#faces = copyFaces(data.faces);
    }
    else {
      this.state = "collapsed";
      this.#faces = sharedFaces(data.rect);
    }
  }

  /**
   * Returns the rect for the given face (shared when collapsed).
   */
  rectFor(
    face: UVFace
  ): SelectionRect {
    return this.#faces[face];
  }

  /**
   * All distinct rects: one (face=null) when collapsed, six when uncollapsed.
   */
  facesOf(): UVRegionFace[] {
    if (this.state === "collapsed") {
      return [{ face: null, rect: this.#faces.front }];
    }

    return UV_FACES.map((face) => {
      return { face, rect: this.#faces[face] };
    });
  }

  collapse(
    face: UVFace = "front"
  ): UVRegion {
    if (this.state === "collapsed") {
      return this;
    }

    return new UVRegion({
      id: this.id,
      color: this.color,
      state: "collapsed",
      rect: this.#faces[face]
    });
  }

  uncollapse(): UVRegion {
    if (this.state === "uncollapsed") {
      return this;
    }

    return new UVRegion({
      id: this.id,
      color: this.color,
      state: "uncollapsed",
      faces: copyFaces(this.#faces)
    });
  }

  /**
   * Replaces one face's rect (or the shared rect when collapsed).
   * Returns `this` when uncollapsed and `face` is omitted (bulk updates not supported).
   */
  withRect(
    rect: SelectionRect,
    face?: UVFace
  ): UVRegion {
    if (this.state === "collapsed") {
      return new UVRegion({
        id: this.id,
        color: this.color,
        state: "collapsed",
        rect
      });
    }

    if (!face) {
      return this;
    }

    const faces = copyFaces(this.#faces);
    faces[face] = copyRect(rect);

    return new UVRegion({
      id: this.id,
      color: this.color,
      state: "uncollapsed",
      faces
    });
  }

  toJSON(): UVRegionData {
    if (this.state === "uncollapsed") {
      return {
        id: this.id,
        color: this.color,
        state: "uncollapsed",
        faces: copyFaces(this.#faces)
      };
    }

    return {
      id: this.id,
      color: this.color,
      state: "collapsed",
      rect: copyRect(this.#faces.front)
    };
  }
}
