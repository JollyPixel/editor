// Import Node.js Dependencies
import {
  afterEach,
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import type { VoxelSetOptions } from "../../src/document/world/VoxelWorld.ts";
import { VoxelTransform } from "../../src/document/geometry/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { makeView } from "../helpers/view.ts";

// CONSTANTS
const kLayer = "Ground";
const kSlabBottom = 1;
const kSlabTop = 2;
const kRamp = 3;
const kCell = {
  x: 2,
  y: 0,
  z: -1
};
const kSeamStep = 1e-4;
const kViews = new Set<VoxelView>();

function makePartView(): VoxelView {
  const view = makeView({
    layers: [kLayer],
    blocks: [
      makeBlockDef(kSlabBottom, "slabBottom"),
      makeBlockDef(kSlabTop, "slabTop"),
      makeBlockDef(kRamp, "ramp")
    ]
  });
  kViews.add(view);

  return view;
}

function mergePair(
  view: VoxelView,
  first: Omit<VoxelSetOptions, "position">,
  second: Omit<VoxelSetOptions, "position">
): void {
  const { world } = view.document;
  world.setVoxel(kLayer, { ...first, position: kCell });
  assert.ok(view.canMergeAt(kLayer, kCell, {
    blockId: second.blockId,
    transform: VoxelTransform.pack(second)
  }));
  world.setVoxel(kLayer, { ...second, position: kCell, merge: true });
}

function blockAt(
  view: VoxelView,
  x: number,
  y: number,
  z: number
): number | undefined {
  return view.partAt(kLayer, kCell, {
    x: kCell.x + x,
    y: kCell.y + y,
    z: kCell.z + z
  })?.blockId;
}

describe("VoxelView.partAt", () => {
  afterEach(() => {
    for (const view of kViews) {
      view.dispose();
    }
    kViews.clear();
  });

  it("resolves each half of a slab pair", () => {
    const view = makePartView();
    mergePair(view, { blockId: kSlabTop }, { blockId: kSlabBottom });

    assert.equal(blockAt(view, 0.5, 0.25, 0.5), kSlabBottom);
    assert.equal(blockAt(view, 0.5, 0.75, 0.5), kSlabTop);
  });

  it("resolves each half of a turned ramp pair", () => {
    const view = makePartView();
    mergePair(
      view,
      { blockId: kRamp, rotation: 1 },
      { blockId: kRamp, rotation: 3, flipY: true }
    );

    assert.deepEqual(
      view.partAt(kLayer, kCell, {
        x: kCell.x + 0.9,
        y: kCell.y + 0.5,
        z: kCell.z + 0.1
      }),
      { blockId: kRamp, transform: VoxelTransform.pack({ rotation: 1 }) }
    );
    assert.deepEqual(
      view.partAt(kLayer, kCell, {
        x: kCell.x + 0.1,
        y: kCell.y + 0.5,
        z: kCell.z + 0.9
      }),
      {
        blockId: kRamp,
        transform: VoxelTransform.pack({ rotation: 3, flipY: true })
      }
    );
  });

  it("resolves a point stepped off the seam to the side it was stepped into", () => {
    const view = makePartView();
    mergePair(view, { blockId: kSlabBottom }, { blockId: kSlabTop });

    assert.equal(blockAt(view, 0.3, 0.5 - kSeamStep, 0.7), kSlabBottom);
    assert.equal(blockAt(view, 0.3, 0.5 + kSeamStep, 0.7), kSlabTop);
  });

  it("returns the only shape of an unmerged cell, wherever the point is", () => {
    const view = makePartView();
    view.document.world.setVoxel(kLayer, {
      position: kCell,
      blockId: kSlabBottom
    });

    assert.equal(blockAt(view, 0.5, 0.75, 0.5), kSlabBottom);
  });

  it("returns null for an empty cell and an unknown layer", () => {
    const view = makePartView();
    const point = {
      x: 0.5,
      y: 0.5,
      z: 0.5
    };

    assert.equal(view.partAt(kLayer, kCell, point), null);
    assert.equal(view.partAt("Missing", kCell, point), null);
  });
});
