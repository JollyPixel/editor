// Import Third-party Dependencies
import * as THREE from "three";
import { Grid } from "@jolly-pixel/three";

// Import Internal Dependencies
import { RenderOrder } from "./renderOrder.ts";

export function createModelGrid(): Grid {
  const grid = new Grid({
    extent: 10,
    cell: {
      color: "#3a3a3a",
      thickness: 1.5
    },
    section: {
      show: false
    },
    fade: {
      from: "origin",
      distance: 100
    },
    axes: {
      show: true
    }
  });
  (grid.material as THREE.Material).side = THREE.DoubleSide;
  grid.renderOrder = RenderOrder.grid;

  return grid;
}
