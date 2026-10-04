// Import Internal Dependencies
import { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import type { UVMap } from "#src/uv/map/UVMap.ts";
import {
  makeSvg,
  makeViewport
} from "../overlay.ts";
import { makeUvMap } from "./map.ts";

// CONSTANTS
export const RECT_SIZE_THAT_FITS_A_LABEL = 12;

export function makeUvLabelSetup(): { svg: SVGElement; map: UVMap; } {
  const svg = makeSvg();
  const map = makeUvMap({ x: 64, y: 64 });
  new UVRegionLayer(
    svg,
    makeViewport(),
    map
  );

  return { svg, map };
}

export function uvLabelTexts(
  svg: SVGElement
): (string | null)[] {
  return [
    ...svg.querySelectorAll("text")
  ].map((el) => el.textContent);
}
