// Import Internal Dependencies
import type { UVMap } from "#src/uv/map/UVMap.ts";
import { UVController } from "#src/tools/uv/UVController.ts";
import type { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import type { Vec2 } from "#src/types.ts";
import { makeUvMap } from "./map.ts";
import { FakeOverlay } from "./overlay.ts";

// CONSTANTS
const kIdentityView = {
  zoom: {
    value: 1
  },
  camera: {
    x: 0,
    y: 0
  }
};

export interface UVControllerSetup {
  map: UVMap;
  overlay: FakeOverlay;
  controller: UVController;
}

export function makeUvControllerSetup(
  size: Vec2 = { x: 32, y: 32 },
  deselectOnEmptyClick?: boolean
): UVControllerSetup {
  const map = makeUvMap(size);
  const overlay = new FakeOverlay();
  const controller = new UVController({
    uvMap: map,
    overlay: overlay as unknown as UVRegionLayer,
    deselectOnEmptyClick,
    viewport: kIdentityView
  });

  return {
    map,
    overlay,
    controller
  };
}
