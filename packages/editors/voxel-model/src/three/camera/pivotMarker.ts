// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kPivotMarkerColor = 0x999999;
const kPivotMarkerSize = 0.2;
const kPivotMarkerRenderOrder = 999;

export function createPivotMarker(): THREE.Object3D {
  const halfSize = kPivotMarkerSize;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfSize, 0, 0), new THREE.Vector3(halfSize, 0, 0),
    new THREE.Vector3(0, -halfSize, 0), new THREE.Vector3(0, halfSize, 0),
    new THREE.Vector3(0, 0, -halfSize), new THREE.Vector3(0, 0, halfSize)
  ]);
  const material = new THREE.LineBasicMaterial({
    color: kPivotMarkerColor,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    toneMapped: false
  });
  const marker = new THREE.LineSegments(geometry, material);
  marker.renderOrder = kPivotMarkerRenderOrder;
  marker.frustumCulled = false;
  marker.visible = false;

  return marker;
}
