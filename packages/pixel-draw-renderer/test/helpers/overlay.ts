// Factories shared across the SVG overlay specs (BrushHighlight, LinePreview,
// Selection, UV) and OverlayLayer.

// Import Internal Dependencies
import { SVG_NS } from "#src/rendering/constants.ts";
import { Zoom } from "#src/rendering/Zoom.ts";
import { UVMap } from "#src/uv/UVMap.ts";
import type {
  DefaultViewport
} from "#src/rendering/Viewport.ts";
import type {
  BrushHighlight,
  Vec2
} from "#src/types.ts";

export function makeSvg(): SVGElement {
  return document.createElementNS(SVG_NS, "svg");
}

export function makeViewport(
  zoom = 4
): DefaultViewport {
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
