// Import Third-party Dependencies
import * as THREE from "three";
import type { UVFace } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kCanvasWidth = 256;
const kCanvasHeight = 64;

export const FACE_LABEL_WIDTH = 0.58;
export const FACE_LABEL_HEIGHT = FACE_LABEL_WIDTH * (
  kCanvasHeight / kCanvasWidth
);
export const FACE_LABEL_MARGIN = 0.09;
export const FACE_LABEL_SURFACE_OFFSET = 0.015;

export function createFaceLabel(
  face: UVFace
): THREE.Mesh {
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(FACE_LABEL_WIDTH, FACE_LABEL_HEIGHT),
    createFaceLabelMaterial(face)
  );
  label.renderOrder = 1;

  return label;
}

function createFaceLabelMaterial(
  face: UVFace
): THREE.MeshBasicMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = kCanvasWidth;
  canvas.height = kCanvasHeight;

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Unable to create face label canvas context");
  }

  context.font = "600 38px sans-serif";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = 8;
  context.strokeStyle = "rgba(0, 0, 0, 0.8)";
  context.fillStyle = "#ffffff";
  context.strokeText(face.toUpperCase(), 12, kCanvasHeight / 2);
  context.fillText(face.toUpperCase(), 12, kCanvasHeight / 2);

  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false
  });
}
