// Import Internal Dependencies
import {
  UVRegion,
  type UVGeometry
} from "#src/uv/region/UVRegion.ts";
import type { PeerUVPreviewState } from "#src/rendering/presence/PeerUVPreview.ts";
import type { SelectionRect } from "#src/types.ts";

// CONSTANTS
export const RECT_GHOST = stackedGhost("region-A", {
  x: 2,
  y: 3,
  width: 5,
  height: 6
});
export const TRIANGLE_GHOST = freeGhost(
  "region-B",
  {
    shape: "triangle",
    rect: {
      x: 0,
      y: 0,
      width: 4,
      height: 4
    },
    corner: "top-left"
  },
  "#00ff00"
);
export const COMPOUND_GHOST = freeGhost(
  "region-C",
  {
    shape: "compound",
    rect: {
      x: 1,
      y: 2,
      width: 4,
      height: 4
    },
    parts: [
      {
        x: 0,
        y: 0,
        width: 1,
        height: 1
      }
    ]
  },
  "#0000ff"
);

export function stackedGhost(
  id: string,
  rect: SelectionRect
): PeerUVPreviewState {
  return {
    region: new UVRegion({
      id,
      color: "#ff0000",
      state: "stacked",
      rect
    }),
    face: null,
    color: "#ff0000"
  };
}

export function freeGhost(
  id: string,
  front: UVGeometry,
  color: string
): PeerUVPreviewState {
  return {
    region: new UVRegion({
      id,
      color,
      state: "free",
      faces: {
        front,
        back: {
          x: 20,
          y: 20,
          width: 2,
          height: 2
        }
      }
    }),
    face: "front",
    color
  };
}
