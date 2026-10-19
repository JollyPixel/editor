// Import Internal Dependencies
import type { UVMap } from "#src/uv/map/UVMap.ts";
import { UVController } from "#src/tools/uv/UVController.ts";
import { TextureGrid } from "#src/grid/TextureGrid.ts";
import type { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import type { Vec2 } from "#src/types.ts";
import { makeUvMap } from "./map.ts";
import { FakeOverlay } from "./overlay.ts";
import { makeViewport } from "../overlay.ts";

export interface UVControllerSetup {
  map: UVMap;
  overlay: FakeOverlay;
  grid: TextureGrid;
  controller: UVController;
}

export function makeUvControllerSetup(
  size: Vec2 = { x: 32, y: 32 },
  deselectOnEmptyClick?: boolean
): UVControllerSetup {
  const map = makeUvMap(size);
  const overlay = new FakeOverlay();
  const grid = new TextureGrid();
  const controller = new UVController({
    uvMap: map,
    overlay: overlay as unknown as UVRegionLayer,
    deselectOnEmptyClick,
    viewport: makeViewport(1),
    grid
  });

  return {
    map,
    overlay,
    grid,
    controller
  };
}
