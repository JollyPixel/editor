// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kFaceAxes: Record<CellFaceId, CoordAxis> = {
  "+x": "x",
  "-x": "x",
  "+y": "y",
  "-y": "y",
  "+z": "z",
  "-z": "z"
};
const kCrossAxes: Record<CoordAxis, readonly [CoordAxis, CoordAxis]> = {
  x: ["y", "z"],
  y: ["x", "z"],
  z: ["x", "y"]
};

export type CoordAxis = "x" | "y" | "z";
export type BrushAnchor = "bottom" | "top" | "center";
export type CellFaceId = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

export interface FaceAnchors {
  place: BrushAnchor;
  remove: BrushAnchor;
}

export class CellFace {
  static readonly PosX = new CellFace("+x");
  static readonly NegX = new CellFace("-x");
  static readonly PosY = new CellFace("+y");
  static readonly NegY = new CellFace("-y");
  static readonly PosZ = new CellFace("+z");
  static readonly NegZ = new CellFace("-z");

  static readonly all: readonly CellFace[] = [
    CellFace.PosX,
    CellFace.NegX,
    CellFace.PosY,
    CellFace.NegY,
    CellFace.PosZ,
    CellFace.NegZ
  ];

  static readonly FREE_ANCHORS: Readonly<FaceAnchors> = Object.freeze({
    place: "center",
    remove: "center"
  });

  static parse(
    value: unknown
  ): CellFace | undefined {
    return CellFace.all.find((face) => face.id === value);
  }

  static fromDirection(
    direction: VoxelCoord
  ): CellFace {
    const x = Math.abs(direction.x);
    const y = Math.abs(direction.y);
    const z = Math.abs(direction.z);

    if (y >= x && y >= z) {
      return direction.y < 0 ? CellFace.NegY : CellFace.PosY;
    }
    if (x >= z) {
      return direction.x < 0 ? CellFace.NegX : CellFace.PosX;
    }

    return direction.z < 0 ? CellFace.NegZ : CellFace.PosZ;
  }

  readonly id: CellFaceId;
  readonly axis: CoordAxis;
  readonly positive: boolean;

  constructor(
    id: CellFaceId
  ) {
    this.id = id;
    this.axis = kFaceAxes[id];
    this.positive = id[0] === "+";

    Object.freeze(this);
  }

  get anchors(): Readonly<FaceAnchors> {
    switch (this.id) {
      case "+y":
        return {
          place: "bottom",
          remove: "top"
        };
      case "-y":
        return {
          place: "top",
          remove: "bottom"
        };
      default:
        return CellFace.FREE_ANCHORS;
    }
  }

  corners(
    cell: VoxelCoord,
    margin = 0
  ): VoxelCoord[] {
    const { axis } = this;
    const [u, v] = kCrossAxes[axis];
    const plane = this.positive ?
      cell[axis] + 1 + margin :
      cell[axis] - margin;
    const lowU = cell[u] - margin;
    const highU = cell[u] + 1 + margin;
    const lowV = cell[v] - margin;
    const highV = cell[v] + 1 + margin;

    function corner(
      first: number,
      second: number
    ): VoxelCoord {
      const point = {
        x: 0,
        y: 0,
        z: 0
      };
      point[axis] = plane;
      point[u] = first;
      point[v] = second;

      return point;
    }

    return [
      corner(lowU, lowV),
      corner(highU, lowV),
      corner(highU, highV),
      corner(lowU, highV)
    ];
  }

  toJSON(): CellFaceId {
    return this.id;
  }
}
