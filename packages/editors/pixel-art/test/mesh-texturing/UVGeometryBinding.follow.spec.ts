// Import Node.js Dependencies
import {
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  UVMap,
  UVRegion,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UVGeometryBinding } from "#src/mesh-texturing/UVGeometryBinding.ts";
import { boxFaceRanges } from "../../page/scripts/preview/shapes/faceRanges.ts";

// CONSTANTS
const kTextureSize: Vec2 = { x: 64, y: 64 };

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

function readUv(
  geometry: THREE.BufferGeometry,
  index: number
): [number, number] {
  const attribute = geometry.getAttribute("uv");

  return [attribute.getX(index), attribute.getY(index)];
}

describe("UVGeometryBinding", () => {
  let geometry: THREE.BufferGeometry;

  beforeEach(() => {
    geometry = makeGeometry();
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

      assert.deepStrictEqual(readUv(geometry, 1), [0.75, 1]);
    });

    test("tracks region-dragging for a resize drag too", () => {
      bindCreated();

      uv.previewResize("tracked", { x: 0, y: 0, width: 32, height: 16 });

      assert.deepStrictEqual(readUv(geometry, 1), [0.5, 1]);
    });

    test("tracks region-moved", () => {
      bindCreated();

      uv.move("tracked", { x: 0, y: 32, width: 16, height: 16 });

      assert.deepStrictEqual(readUv(geometry, 0), [0, 0.5]);
    });

    test("reprojects every face of an unfolded region moved as a whole", () => {
      const region = uv.create({
        id: "net",
        width: 16,
        height: 16,
        state: "unfolded"
      });
      const binding = new UVGeometryBinding({
        geometry,
        region,
        textureSize: kTextureSize,
        faceRanges: boxFaceRanges()
      });
      binding.follow(uv);

      uv.move("net", { ...uv.get("net")!.bounds, x: 0, y: 0 });

      const expected = makeGeometry();
      new UVGeometryBinding({
        geometry: expected,
        region: uv.get("net")!,
        textureSize: kTextureSize,
        faceRanges: boxFaceRanges()
      });
      for (let index = 0; index < 24; index++) {
        assert.deepStrictEqual(readUv(geometry, index), readUv(expected, index));
      }
    });

    test("tracks region-state-changed", () => {
      const binding = bindCreated();

      uv.applyState("tracked", "free");

      assert.strictEqual(binding.regionId, "tracked");
      assert.deepStrictEqual(readUv(geometry, 0), [0, 1]);
    });

    test("tracks region-rotated", () => {
      bindCreated();

      uv.rotate("tracked", "cw");

      assert.deepStrictEqual(readUv(geometry, 0), [0.25, 1]);
      assert.deepStrictEqual(readUv(geometry, 1), [0.25, 0.75]);
    });

    test("keeps the rotation while a rotated region is dragged", () => {
      bindCreated();
      uv.rotate("tracked", "cw");

      uv.previewMove("tracked", { x: 32, y: 0, width: 16, height: 16 });

      assert.deepStrictEqual(readUv(geometry, 0), [0.75, 1]);
      assert.deepStrictEqual(readUv(geometry, 1), [0.75, 0.75]);
    });

    test("preview projects a drag that did not come from the followed map", () => {
      const binding = bindCreated();
      const region = uv.get("tracked")!;

      binding.preview(region.movedTo({ x: 32, y: 0 }));

      assert.deepStrictEqual(readUv(geometry, 1), [0.75, 1]);
    });

    test("preview ignores another region", () => {
      const binding = bindCreated();
      const before = readUv(geometry, 1);

      binding.preview(UVRegion.from({
        id: "other",
        color: "#00ff00",
        state: "stacked",
        rect: { x: 32, y: 0, width: 16, height: 16 }
      }));

      assert.deepStrictEqual(readUv(geometry, 1), before);
    });

    test("ignores events for other regions", () => {
      bindCreated();
      uv.create({ id: "other", width: 16, height: 16 });
      const before = readUv(geometry, 1);

      uv.previewMove("other", { x: 48, y: 48, width: 16, height: 16 });

      assert.deepStrictEqual(readUv(geometry, 1), before);
    });

    test("unfollow stops tracking", () => {
      const binding = bindCreated();
      binding.unfollow();
      const before = readUv(geometry, 1);

      uv.previewMove("tracked", { x: 32, y: 0, width: 16, height: 16 });

      assert.deepStrictEqual(readUv(geometry, 1), before);
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

      assert.deepStrictEqual(readUv(geometry, 1), [0.75, 1]);
    });
  });
});
