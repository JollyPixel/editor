// Import Internal Dependencies
import {
  FACE,
  FACES,
  FACE_AXIS,
  FACE_NORMALS,
  FACE_POSITIVE,
  type Vec3
} from "../../../geometry/faceDirection.ts";
import {
  defineFace,
  type FaceDefinition
} from "../../face/index.ts";
import { BlockShapeBase } from "../BlockShapeBase.ts";
import type {
  BlockCollisionHint,
  BlockShapeID
} from "../BlockShape.ts";

export interface Junction {
  min: Vec3;
  max: Vec3;
  arms?: readonly FACE[];
}

type Range = readonly [number, number];
type Spans = readonly [Range, Range, Range];

type QuadVertices = (
  plane: number,
  a: Range,
  b: Range
) => Vec3[];

// CONSTANTS
const kTrunkOrder = [2, 0, 1] as const;
const kAxisFaces = [
  [FACE.NegX, FACE.PosX],
  [FACE.NegY, FACE.PosY],
  [FACE.NegZ, FACE.PosZ]
] as const;
const kPlaneAxes = [
  [2, 1],
  [0, 2],
  [0, 1]
] as const;
const kQuadVertices: Record<FACE, QuadVertices> = {
  [FACE.PosX]: (x, [z0, z1], [y0, y1]) => [
    [x, y0, z0],
    [x, y1, z0],
    [x, y1, z1],
    [x, y0, z1]
  ],
  [FACE.NegX]: (x, [z0, z1], [y0, y1]) => [
    [x, y0, z1],
    [x, y1, z1],
    [x, y1, z0],
    [x, y0, z0]
  ],
  [FACE.PosY]: (y, [x0, x1], [z0, z1]) => [
    [x0, y, z0],
    [x0, y, z1],
    [x1, y, z1],
    [x1, y, z0]
  ],
  [FACE.NegY]: (y, [x0, x1], [z0, z1]) => [
    [x0, y, z1],
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1]
  ],
  [FACE.PosZ]: (z, [x0, x1], [y0, y1]) => [
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z]
  ],
  [FACE.NegZ]: (z, [x0, x1], [y0, y1]) => [
    [x1, y0, z],
    [x0, y0, z],
    [x0, y1, z],
    [x1, y1, z]
  ]
};

export class JunctionShape extends BlockShapeBase {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint;
  readonly faces: readonly FaceDefinition[];

  #core: Spans;
  #arms: ReadonlySet<FACE>;

  constructor(
    id: BlockShapeID,
    junction: Junction
  ) {
    super();
    const { min, max, arms = [] } = junction;

    this.id = id;
    this.#core = [
      [min[0], max[0]],
      [min[1], max[1]],
      [min[2], max[2]]
    ];
    this.#arms = new Set(arms);
    this.collisionHint = kTrunkOrder
      .filter((axis) => this.#reaches(axis))
      .length > 1 ? "trimesh" : "box";
    this.faces = FACES.flatMap((face) => this.#facesToward(face));
  }

  #facesToward(
    face: FACE
  ): FaceDefinition[] {
    const axis = FACE_AXIS[face];
    const [low, high] = this.#core[axis];
    const plane = FACE_POSITIVE[face] ? high : low;
    const open = this.#arms.has(face);
    const trunk = open ?
      undefined :
      kTrunkOrder.find((along) => along !== axis && this.#reaches(along));

    const pieces: Spans[] = [];
    if (!open) {
      pieces.push(trunk === undefined ? this.#core : this.#barAlong(trunk));
    }
    for (const along of kTrunkOrder) {
      if (along !== axis && along !== trunk) {
        pieces.push(...this.#armsAlong(along));
      }
    }

    const quads = pieces.map((spans) => quad(face, plane, spans));

    return open ?
      [quad(face, FACE_POSITIVE[face] ? 1 : 0, this.#core), ...quads] :
      quads;
  }

  #reaches(
    axis: number
  ): boolean {
    return kAxisFaces[axis].some((face) => this.#arms.has(face));
  }

  #barAlong(
    axis: number
  ): Spans {
    const [negative, positive] = kAxisFaces[axis];
    const [low, high] = this.#core[axis];

    return this.#spansWith(axis, [
      this.#arms.has(negative) ? 0 : low,
      this.#arms.has(positive) ? 1 : high
    ]);
  }

  #armsAlong(
    axis: number
  ): Spans[] {
    const [negative, positive] = kAxisFaces[axis];
    const [low, high] = this.#core[axis];
    const arms: Spans[] = [];
    if (this.#arms.has(negative)) {
      arms.push(this.#spansWith(axis, [0, low]));
    }
    if (this.#arms.has(positive)) {
      arms.push(this.#spansWith(axis, [high, 1]));
    }

    return arms;
  }

  #spansWith(
    axis: number,
    range: Range
  ): Spans {
    const spans: [Range, Range, Range] = [...this.#core];
    spans[axis] = range;

    return spans;
  }
}

function quad(
  face: FACE,
  plane: number,
  spans: Spans
): FaceDefinition {
  const [a, b] = kPlaneAxes[FACE_AXIS[face]];

  return defineFace({
    face,
    normal: FACE_NORMALS[face],
    vertices: kQuadVertices[face](plane, spans[a], spans[b])
  });
}
