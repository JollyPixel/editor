// Import Third-party Dependencies
import * as THREE from "three";
import {
  UV_FACES,
  type UVFace
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PREVIEW_SHAPE_SIZE,
  type PreviewShape
} from "../PreviewShape.ts";
import { createRoundedBoxBorder } from "./borders.ts";
import {
  FACE_LABEL_HEIGHT,
  FACE_LABEL_MARGIN,
  FACE_LABEL_SURFACE_OFFSET,
  FACE_LABEL_WIDTH,
  createFaceLabel
} from "./faceLabels.ts";

// CONSTANTS
const kFaceRanges = {
  right: { start: 0, count: 4 },
  left: { start: 4, count: 4 },
  top: { start: 8, count: 4 },
  bottom: { start: 12, count: 4 },
  front: { start: 16, count: 4 },
  back: { start: 20, count: 4 }
} satisfies PreviewShape["faceRanges"];

export function createCubeShape(
  borderMaterial: THREE.MeshBasicMaterial
): PreviewShape {
  return {
    geometry: new THREE.BoxGeometry(
      PREVIEW_SHAPE_SIZE,
      PREVIEW_SHAPE_SIZE,
      PREVIEW_SHAPE_SIZE
    ),
    faceRanges: kFaceRanges,
    decorations: [
      createRoundedBoxBorder(PREVIEW_SHAPE_SIZE, borderMaterial),
      ...createFaceLabels()
    ]
  };
}

function createFaceLabels(): THREE.Object3D[] {
  return UV_FACES.map((face) => {
    const label = createFaceLabel(face);
    const faceObject = new THREE.Object3D();
    const halfSize = PREVIEW_SHAPE_SIZE / 2;

    label.position.set(
      -halfSize + FACE_LABEL_MARGIN + (FACE_LABEL_WIDTH / 2),
      halfSize - FACE_LABEL_MARGIN - (FACE_LABEL_HEIGHT / 2),
      halfSize + FACE_LABEL_SURFACE_OFFSET
    );
    faceObject.rotation.copy(faceRotation(face));
    faceObject.add(label);

    return faceObject;
  });
}

function faceRotation(
  face: UVFace
): THREE.Euler {
  switch (face) {
    case "right":
      return new THREE.Euler(0, Math.PI / 2, 0);
    case "left":
      return new THREE.Euler(0, -Math.PI / 2, 0);
    case "top":
      return new THREE.Euler(-Math.PI / 2, 0, 0);
    case "bottom":
      return new THREE.Euler(Math.PI / 2, 0, 0);
    case "back":
      return new THREE.Euler(0, Math.PI, 0);
    case "front":
      return new THREE.Euler();
    default:
      throw new Error(`Unknown preview face: ${face}`);
  }
}
