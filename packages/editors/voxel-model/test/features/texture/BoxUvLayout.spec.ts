// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import { DEFAULT_UV_SLOTS } from "@jolly-pixel/pixel-draw.renderer";
import type { MirrorAxes } from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import { BoxUvLayout } from "#src/features/texture/BoxUvLayout.ts";

// CONSTANTS
const kSlots = ["right", "left", "top", "bottom", "front", "back"] as const;
const kFaceVertexCount = 4;

interface LayoutCase {
  axes: MirrorAxes;
  starts: number[];
  mirroredU: [x: boolean, y: boolean, z: boolean];
}

const kCases: LayoutCase[] = [
  {
    axes: { x: false, y: false, z: false },
    starts: [0, 4, 8, 12, 16, 20],
    mirroredU: [false, false, false]
  },
  {
    axes: { x: true, y: false, z: false },
    starts: [4, 0, 8, 12, 16, 20],
    mirroredU: [false, true, true]
  },
  {
    axes: { x: false, y: true, z: false },
    starts: [0, 4, 12, 8, 16, 20],
    mirroredU: [true, false, true]
  },
  {
    axes: { x: false, y: false, z: true },
    starts: [0, 4, 8, 12, 20, 16],
    mirroredU: [true, true, false]
  },
  {
    axes: { x: true, y: true, z: false },
    starts: [4, 0, 12, 8, 16, 20],
    mirroredU: [true, true, false]
  },
  {
    axes: { x: true, y: false, z: true },
    starts: [4, 0, 8, 12, 20, 16],
    mirroredU: [true, false, true]
  },
  {
    axes: { x: false, y: true, z: true },
    starts: [0, 4, 12, 8, 20, 16],
    mirroredU: [false, true, true]
  },
  {
    axes: { x: true, y: true, z: true },
    starts: [4, 0, 12, 8, 20, 16],
    mirroredU: [false, false, false]
  }
];

function label(
  axes: MirrorAxes
): string {
  const mirrored = (["x", "y", "z"] as const)
    .filter((axis) => axes[axis])
    .join("");

  return mirrored === "" ? "no mirror" : `${mirrored} mirror`;
}

function faceU(
  geometry: THREE.BufferGeometry
): number[][] {
  const uv = geometry.getAttribute("uv");

  return kSlots.map((_, face) => Array.from(
    { length: kFaceVertexCount },
    (_corner, corner) => uv.getX((face * kFaceVertexCount) + corner)
  ));
}

describe("BoxUvLayout faceRanges", () => {
  test("covers every default slot", () => {
    assert.deepEqual(
      Object.keys(new BoxUvLayout().faceRanges).sort(),
      [...DEFAULT_UV_SLOTS].sort()
    );
  });

  test("defaults to the unmirrored layout", () => {
    assert.deepEqual(
      new BoxUvLayout().faceRanges,
      new BoxUvLayout({ x: false, y: false, z: false }).faceRanges
    );
  });

  test("cannot be mutated", () => {
    const { faceRanges } = new BoxUvLayout();

    assert.ok(Object.isFrozen(faceRanges));
  });

  for (const { axes, starts } of kCases) {
    test(`swaps the faces perpendicular to each mirrored axis (${label(axes)})`, () => {
      const { faceRanges } = new BoxUvLayout(axes);

      assert.deepEqual(
        kSlots.map((slot) => faceRanges[slot]),
        starts.map((start) => [{ start, count: kFaceVertexCount }])
      );
    });
  }
});

describe("BoxUvLayout applyDefaults", () => {
  for (const { axes, mirroredU } of kCases) {
    test(`mirrors U on faces seen through an odd number of mirrors (${label(axes)})`, () => {
      const geometry = new THREE.BoxGeometry();

      new BoxUvLayout(axes).applyDefaults(geometry);

      const [x, y, z] = mirroredU;
      assert.deepEqual(
        faceU(geometry),
        [x, x, y, y, z, z].map(
          (mirrored) => (mirrored ? [1, 0, 1, 0] : [0, 1, 0, 1])
        )
      );
    });
  }

  test("restores V and overwrites previously mapped UVs", () => {
    const geometry = new THREE.BoxGeometry();
    const uv = geometry.getAttribute("uv");
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, 0.25, 0.75);
    }

    new BoxUvLayout().applyDefaults(geometry);

    assert.deepEqual(
      Array.from({ length: kFaceVertexCount }, (_, corner) => uv.getY(corner)),
      [1, 1, 0, 0]
    );
    assert.deepEqual(
      Array.from(uv.array),
      Array.from(new THREE.BoxGeometry().getAttribute("uv").array)
    );
  });

  test("flags the attribute for upload", () => {
    const geometry = new THREE.BoxGeometry();
    const uv = geometry.getAttribute("uv");
    assert.ok(uv instanceof THREE.BufferAttribute);
    const before = uv.version;

    new BoxUvLayout().applyDefaults(geometry);

    assert.equal(uv.version, before + 1);
  });
});
