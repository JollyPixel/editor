// Import Node.js Dependencies
import {
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  UVMap,
  UVRegion,
  type UVRegion as UVRegionType,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UVGeometryBinding } from "#src/three/UVGeometryBinding.ts";
import { boxFaceRanges } from "../../examples/scripts/preview/shapes/faceRanges.ts";

// CONSTANTS
const kTextureSize: Vec2 = { x: 64, y: 64 };

// A four-vertex quad, one per box face slot, so a face range of
// { start, count } lands on exactly one vertex pair per assertion.
function makeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const uvs: number[] = [];
  for (let face = 0; face < 6; face++) {
    uvs.push(0, 1, 1, 1, 0, 0, 1, 0);
  }
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );

  return geometry;
}

function uvOf(
  geometry: THREE.BufferGeometry,
  index: number
): [number, number] {
  const attribute = geometry.getAttribute("uv");

  return [attribute.getX(index), attribute.getY(index)];
}

function collapsedRegion(
  rect = { x: 0, y: 0, width: 16, height: 16 }
): UVRegionType {
  return UVRegion.from({
    id: "region-a",
    color: "#ff0000",
    state: "collapsed",
    rect
  });
}

describe("UVGeometryBinding", () => {
  let geometry: THREE.BufferGeometry;

  beforeEach(() => {
    geometry = makeGeometry();
  });

  test("projects a collapsed region across every vertex on construction", () => {
    new UVGeometryBinding({
      geometry,
      region: collapsedRegion(),
      textureSize: kTextureSize,
      faceRanges: boxFaceRanges()
    });

    // rect 0,0 16x16 of a 64px texture: u in [0, 0.25], v in [0.75, 1].
    assert.deepStrictEqual(uvOf(geometry, 0), [0, 1]);
    assert.deepStrictEqual(uvOf(geometry, 1), [0.25, 1]);
    assert.deepStrictEqual(uvOf(geometry, 2), [0, 0.75]);
    assert.deepStrictEqual(uvOf(geometry, 23), [0.25, 0.75]);
  });

  test("exposes the bound region id", () => {
    const binding = new UVGeometryBinding({
      geometry,
      region: collapsedRegion(),
      textureSize: kTextureSize,
      faceRanges: boxFaceRanges()
    });

    assert.strictEqual(binding.regionId, "region-a");
  });

  test("applyFace rewrites only the named face's vertex range", () => {
    const binding = new UVGeometryBinding({
      geometry,
      region: collapsedRegion(),
      textureSize: kTextureSize,
      faceRanges: boxFaceRanges()
    });

    binding.applyFace("top", { x: 32, y: 0, width: 16, height: 16 });

    // "top" is vertices 8..11; "left" (4..7) keeps the collapsed projection.
    assert.deepStrictEqual(uvOf(geometry, 8), [0.5, 1]);
    assert.deepStrictEqual(uvOf(geometry, 9), [0.75, 1]);
    assert.deepStrictEqual(uvOf(geometry, 4), [0, 1]);
  });

  test("applyFace ignores a face the geometry has no range for", () => {
    const binding = new UVGeometryBinding({
      geometry,
      region: collapsedRegion(),
      textureSize: kTextureSize,
      faceRanges: { front: [{ start: 16, count: 4 }] }
    });

    binding.applyFace("top", { x: 32, y: 0, width: 16, height: 16 });

    assert.deepStrictEqual(uvOf(geometry, 8), [0, 1]);
  });

  test("setTextureSize reprojects the region against the new size", () => {
    const binding = new UVGeometryBinding({
      geometry,
      region: collapsedRegion(),
      textureSize: kTextureSize,
      faceRanges: boxFaceRanges()
    });

    binding.setTextureSize({ x: 32, y: 32 });

    assert.deepStrictEqual(uvOf(geometry, 1), [0.5, 1]);
    assert.deepStrictEqual(uvOf(geometry, 2), [0, 0.5]);
  });

  test("setRegion rebinds to another region", () => {
    const binding = new UVGeometryBinding({
      geometry,
      region: collapsedRegion(),
      textureSize: kTextureSize,
      faceRanges: boxFaceRanges()
    });

    binding.setRegion(UVRegion.from({
      id: "region-b",
      color: "#00ff00",
      state: "collapsed",
      rect: { x: 0, y: 32, width: 16, height: 16 }
    }));

    assert.strictEqual(binding.regionId, "region-b");
    assert.deepStrictEqual(uvOf(geometry, 0), [0, 0.5]);
  });

  describe("follow", () => {
    let uv: UVMap;

    beforeEach(() => {
      uv = new UVMap({ getCanvasSize: () => kTextureSize });
    });

    function bindCreated(): UVGeometryBinding {
      const region = uv.create({ id: "tracked", width: 16, height: 16 });
      const binding = new UVGeometryBinding({
        geometry,
        region,
        textureSize: kTextureSize,
        faceRanges: boxFaceRanges()
      });
      binding.follow(uv);

      return binding;
    }

    test("tracks region-dragging, so the mesh follows the pointer", () => {
      bindCreated();

      uv.previewMove("tracked", { x: 32, y: 0, width: 16, height: 16 });

      assert.deepStrictEqual(uvOf(geometry, 1), [0.75, 1]);
    });

    test("tracks region-moved", () => {
      bindCreated();

      uv.move("tracked", { x: 0, y: 32, width: 16, height: 16 });

      assert.deepStrictEqual(uvOf(geometry, 0), [0, 0.5]);
    });

    test("tracks region-state-changed", () => {
      const binding = bindCreated();

      uv.uncollapse("tracked");

      assert.strictEqual(binding.regionId, "tracked");
      assert.deepStrictEqual(uvOf(geometry, 0), [0, 1]);
    });

    test("ignores events for other regions", () => {
      bindCreated();
      uv.create({ id: "other", width: 16, height: 16 });
      const before = uvOf(geometry, 1);

      uv.previewMove("other", { x: 48, y: 48, width: 16, height: 16 });

      assert.deepStrictEqual(uvOf(geometry, 1), before);
    });

    test("unfollow stops tracking", () => {
      const binding = bindCreated();
      binding.unfollow();
      const before = uvOf(geometry, 1);

      uv.previewMove("tracked", { x: 32, y: 0, width: 16, height: 16 });

      assert.deepStrictEqual(uvOf(geometry, 1), before);
    });

    test("unfollow is idempotent", () => {
      const binding = bindCreated();

      binding.unfollow();
      binding.unfollow();
    });

    test("following twice does not double-apply", () => {
      const binding = bindCreated();
      binding.follow(uv);

      uv.previewMove("tracked", { x: 32, y: 0, width: 16, height: 16 });

      assert.deepStrictEqual(uvOf(geometry, 1), [0.75, 1]);
    });
  });
});
