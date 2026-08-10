// Factories shared across the SVG overlay specs (BrushHighlight, LinePreview,
// Selection, UV) and OverlayLayer.

// Import Internal Dependencies
import { SVG_NS } from "#src/rendering/constants.ts";
import { Zoom } from "#src/rendering/Zoom.ts";
import { UVMap } from "#src/uv/UVMap.ts";
import { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import type {
  DefaultViewport
} from "#src/rendering/Viewport.ts";
import type {
  BrushHighlight,
  Vec2
} from "#src/types.ts";

type MutableViewport = DefaultViewport & { camera: Vec2; };

export function makeSvg(): SVGElement {
  return document.createElementNS(SVG_NS, "svg");
}

export function makeViewport(
  zoom = 4
): MutableViewport {
  return {
    zoom: new Zoom({
      default: zoom
    }),
    camera: { x: 0, y: 0 }
  };
}

export function makeBrush(
  size = 1
): BrushHighlight {
  return {
    size,
    colorInline: "#FFF",
    colorOutline: "#000"
  };
}

export function makeUvMap(
  size: Vec2 = { x: 64, y: 64 }
): UVMap {
  return new UVMap({
    getCanvasSize: () => size
  });
}

export function makeUvOverlay(
  svg: SVGElement,
  viewport: DefaultViewport,
  uvMap: UVMap = makeUvMap()
): UVRegionLayer {
  return new UVRegionLayer(svg, viewport, uvMap);
}
