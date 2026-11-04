// Import Third-party Dependencies
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
    },
    doubleSided: true
  });
  grid.renderOrder = RenderOrder.grid;

  return grid;
}
