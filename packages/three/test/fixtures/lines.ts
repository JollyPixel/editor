// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";

export function strokes(
  object: THREE.Object3D
): LineSegments2[] {
  const found: LineSegments2[] = [];
  object.traverse((child) => {
    if (child instanceof LineSegments2) {
      found.push(child);
    }
  });

  return found;
}

export function colorStrokes(
  object: THREE.Object3D
): LineSegments2[] {
  return strokes(object).filter((stroke) => stroke.material.colorWrite);
}

export function strokeColor(
  object: THREE.Object3D
): string {
  const [top] = colorStrokes(object).sort(
    (left, right) => right.renderOrder - left.renderOrder
  );

  return top.material.color.getHexString();
}

export function lineSegments(
  object: THREE.Object3D
): THREE.Line3[] {
  const [stroke] = strokes(object);
  const start = stroke.geometry.getAttribute("instanceStart");
  const end = stroke.geometry.getAttribute("instanceEnd");
  const segments: THREE.Line3[] = [];
  for (let index = 0; index < start.count; index++) {
    segments.push(new THREE.Line3(
      new THREE.Vector3().fromBufferAttribute(start, index),
      new THREE.Vector3().fromBufferAttribute(end, index)
    ));
  }

  return segments;
}
