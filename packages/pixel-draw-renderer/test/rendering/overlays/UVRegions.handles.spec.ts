// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import {
  makeSvg,
  makeViewport
} from "../../helpers/overlay.ts";
import { makeUvMap } from "../../helpers/uv/map.ts";

describe("UVRegionLayer — resize handles", () => {
  function handles(
    svg: SVGElement
  ): number {
    return svg.querySelectorAll("[part='uv-resize-handle']").length;
  }

  test("draws corners on the selected region only while enabled, never on a net", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });
    const layer = new UVRegionLayer(svg, makeViewport(), map);
    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);

    assert.equal(handles(svg), 0);

    layer.editing = true;
    layer.resizable = true;
    assert.equal(handles(svg), 4);

    map.setState(region.id, "unfolded");
    assert.equal(handles(svg), 0);

    map.setState(region.id, "stacked");
    map.select(null);
    assert.equal(handles(svg), 0);
  });

  test("hides them while a drag is previewed", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });
    const layer = new UVRegionLayer(svg, makeViewport(), map);
    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);
    layer.editing = true;
    layer.resizable = true;

    layer.setLivePreview({
      regions: [region.resized({ ...region.bounds, width: 10 })],
      slot: null
    });
    assert.equal(handles(svg), 0);
    layer.setLivePreview(null);
    assert.equal(handles(svg), 4);
  });
});
