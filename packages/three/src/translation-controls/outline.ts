// Import Third-party Dependencies
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

// Import Internal Dependencies
import type { TranslationOutlineOptions } from "./types.ts";

export function createTranslationOutline(
  geometry: THREE.BufferGeometry,
  options: Required<TranslationOutlineOptions>,
  depthTest: boolean,
  renderOrder: number
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  const outline = new THREE.Mesh(
    createOutlineGeometry(geometry, options.scale),
    new THREE.MeshBasicMaterial({
      color: options.color,
      transparent: true,
      opacity: options.opacity,
      depthTest,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      side: THREE.BackSide
    })
  );
  outline.name = "translation-handle-outline";
  outline.renderOrder = renderOrder;
  outline.frustumCulled = false;

  return outline;
}

function createOutlineGeometry(
  geometry: THREE.BufferGeometry,
  scale: number
): THREE.BufferGeometry {
  const outline = mergeVertices(geometry.clone());
  outline.computeVertexNormals();
  outline.computeBoundingSphere();

  const position = outline.getAttribute("position");
  const normal = outline.getAttribute("normal");
  const radius = outline.boundingSphere?.radius ?? 1;
  const thickness = radius * (scale - 1);
  for (let index = 0; index < position.count; index++) {
    position.setXYZ(
      index,
      position.getX(index) + (normal.getX(index) * thickness),
      position.getY(index) + (normal.getY(index) * thickness),
      position.getZ(index) + (normal.getZ(index) * thickness)
    );
  }
  position.needsUpdate = true;
  outline.computeBoundingBox();
  outline.computeBoundingSphere();

  return outline;
}
