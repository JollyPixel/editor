// Import Third-party Dependencies
import * as THREE from "three";

export function centeredGridPositions(
  count: number,
  spacing: number
): THREE.Vector3[] {
  if (count === 0) {
    return [];
  }

  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const centerColumn = (columns - 1) / 2;
  const centerRow = (rows - 1) / 2;

  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return new THREE.Vector3(
      (column - centerColumn) * spacing,
      (centerRow - row) * spacing,
      0
    );
  });
}
