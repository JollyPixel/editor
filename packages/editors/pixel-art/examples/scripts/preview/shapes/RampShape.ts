// Import Third-party Dependencies
import * as THREE from "three";
import type { UVFace } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { rampFaceRanges } from "./faceRanges.ts";
import {
  PREVIEW_SHAPE_SIZE,
  type PreviewShape
} from "../PreviewShape.ts";
import { createEdgeBorder } from "./borders.ts";
import {
  FACE_LABEL_HEIGHT,
  FACE_LABEL_MARGIN,
  FACE_LABEL_SURFACE_OFFSET,
  FACE_LABEL_WIDTH,
  createFaceLabel
} from "./faceLabels.ts";

// CONSTANTS
const kBorderEdges = [
  [0, 1], [1, 5], [5, 3], [3, 0], [5, 4],
  [4, 2], [2, 1], [2, 0], [3, 4]
] as const;

export function createRampShape(
  borderMaterial: THREE.MeshBasicMaterial
): PreviewShape {
  return {
    geometry: createGeometry(),
    faceRanges: rampFaceRanges(),
    decorations: [
      createBorder(borderMaterial),
      ...createFaceLabels()
    ]
  };
}

function createGeometry(): THREE.BufferGeometry {
  const half = PREVIEW_SHAPE_SIZE / 2;
  const vertices = [
    [0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
    [0, 0, 0], [0, 0, 1], [0, 1, 1],
    [1, 0, 0], [1, 1, 1], [1, 0, 1],
    [0, 0, 0], [0, 1, 1], [1, 1, 1], [1, 0, 0]
  ];
  const positions = vertices.flatMap(([x, y, z]) => [
    (x * PREVIEW_SHAPE_SIZE) - half,
    (y * PREVIEW_SHAPE_SIZE) - half,
    (z * PREVIEW_SHAPE_SIZE) - half
  ]);
  const uvs = [
    0, 0, 0, 1, 1, 1, 1, 0,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1,
    0, 0, 1, 1, 1, 0,
    0, 0, 0, 1, 1, 1, 1, 0
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );
  geometry.setIndex([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10,
    11, 12, 13,
    14, 15, 16, 14, 16, 17
  ]);
  geometry.computeVertexNormals();

  return geometry;
}

function createBorder(
  material: THREE.MeshBasicMaterial
): THREE.Mesh {
  const half = PREVIEW_SHAPE_SIZE / 2;
  const points = [
    new THREE.Vector3(-half, -half, -half),
    new THREE.Vector3(-half, -half, half),
    new THREE.Vector3(-half, half, half),
    new THREE.Vector3(half, -half, -half),
    new THREE.Vector3(half, half, half),
    new THREE.Vector3(half, -half, half)
  ];

  return createEdgeBorder(
    points,
    kBorderEdges,
    material,
    "Unable to merge ramp border geometry"
  );
}

function createFaceLabels(): THREE.Object3D[] {
  const half = PREVIEW_SHAPE_SIZE / 2;
  const offset = FACE_LABEL_SURFACE_OFFSET;
  const left = -half + FACE_LABEL_MARGIN + (FACE_LABEL_WIDTH / 2);
  const top = half - FACE_LABEL_MARGIN - (FACE_LABEL_HEIGHT / 2);

  return [
    positionedLabel(
      "bottom",
      [left, -half - offset, top],
      [Math.PI / 2, 0, 0]
    ),
    positionedLabel("back", [left, top, half + offset], [0, 0, 0]),
    positionedLabel("left", [
      -half - offset,
      -half + FACE_LABEL_MARGIN + (FACE_LABEL_HEIGHT / 2),
      half - FACE_LABEL_MARGIN
    ], [0, -Math.PI / 2, 0]),
    positionedLabel("right", [
      half + offset,
      -half + FACE_LABEL_MARGIN + (FACE_LABEL_HEIGHT / 2),
      half - FACE_LABEL_MARGIN - (FACE_LABEL_WIDTH / 2)
    ], [0, Math.PI / 2, 0]),
    positionedLabel("top", [
      left,
      top + (offset * Math.SQRT1_2),
      top - (offset * Math.SQRT1_2)
    ], [-(3 * Math.PI) / 4, 0, 0])
  ];
}

function positionedLabel(
  face: UVFace,
  position: [number, number, number],
  rotation: [number, number, number]
): THREE.Mesh {
  const label = createFaceLabel(face);
  label.position.set(...position);
  label.rotation.set(...rotation);

  return label;
}
