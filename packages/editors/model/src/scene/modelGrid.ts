// Import Third-party Dependencies
import { Grid } from "@jolly-pixel/three";
import type * as THREE from "three/webgpu";

// CONSTANTS
const kCellsPerSection = 10;
const kMargin = 3;
const kEmptyHalfSize = 1;

export function createModelGrid(
  bounds: THREE.Box3
): Grid {
  const halfSize = bounds.isEmpty() ?
    kEmptyHalfSize :
    Math.max(
      Math.abs(bounds.min.x),
      Math.abs(bounds.max.x),
      Math.abs(bounds.min.z),
      Math.abs(bounds.max.z),
      Number.EPSILON
    );
  const cell = 10 ** (Math.floor(Math.log10(halfSize * 2)) - 1);
  const section = cell * kCellsPerSection;
  const extent = Math.ceil(halfSize * 2 * kMargin / section) * section;

  const grid = new Grid({
    extent,
    cell: {
      size: cell,
      color: "#3a3a3a",
      thickness: 1.5
    },
    section: {
      size: kCellsPerSection,
      color: "#5a5a5a"
    },
    fade: {
      from: "origin",
      distance: extent
    },
    axes: {
      show: true
    },
    doubleSided: true
  });
  grid.position.y = bounds.isEmpty() ? 0 : Math.min(0, bounds.min.y);

  return grid;
}
