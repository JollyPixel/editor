// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { UVRegion } from "@jolly-pixel/pixel-draw.renderer";
import { BlockTransform } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  TEXTURE_SIZE,
  createTextureHarness,
  regionIdOf,
  stackedAt,
  uvOf
} from "./textureHarness.ts";

function bound() {
  const harness = createTextureHarness();
  const block = harness.addBlock({ uv: stackedAt(0) });
  harness.changes.length = 0;

  return {
    ...harness,
    block,
    regionId: regionIdOf(block)
  };
}

describe("BlockTextures UV edits", () => {
  test("writes a moved region to the model as one command", () => {
    const { document, uv, block, regionId, changes } = bound();

    uv.move(regionId, { x: 64, y: 32, width: 16, height: 16 });

    assert.deepEqual(uvOf(block, 1), [80 / TEXTURE_SIZE.x, 1 - (32 / TEXTURE_SIZE.y)]);
    assert.deepEqual(document.tree.block(block.uuid)?.uv, stackedAt(64, 32));
    assert.deepEqual(
      changes.map((change) => change.command.action),
      ["node-uv-changed"]
    );
  });

  test("without UV rights puts a moved region back on the model's layout and sends nothing", () => {
    const { access, document, uv, block, regionId, changes } = bound();
    const stored = document.tree.block(block.uuid)?.uv;
    access.grant("hierarchy");

    uv.move(regionId, { x: 64, y: 32, width: 16, height: 16 });

    assert.deepEqual(changes, []);
    assert.deepEqual(uv.get(regionId)?.toLayout(), stored);
  });

  test("sends no texture command and records no texture history", () => {
    const { pixels, pixelEvents, uv, regionId } = bound();
    const pixelChanges: unknown[] = [];
    pixels.on("change", (change) => pixelChanges.push(change));

    uv.move(regionId, { x: 64, y: 32, width: 16, height: 16 });
    uv.rotate(regionId, "cw");
    uv.setState(regionId, "unfolded");

    assert.deepEqual(pixelEvents, []);
    assert.deepEqual(pixelChanges, []);
  });

  test("applies a remote UV change to the region without echoing it", () => {
    const { document, uv, block, regionId, changes } = bound();

    document.apply({
      action: "node-uv-changed",
      id: block.uuid,
      uv: stackedAt(64, 32)
    });

    assert.deepEqual(
      uv.get(regionId)?.geometryFor("front"),
      { x: 64, y: 32, width: 16, height: 16 }
    );
    assert.deepEqual(
      changes.map((change) => [change.command.action, change.origin]),
      [["node-uv-changed", "remote"]]
    );
  });

  test("maps a region while it is still being dragged, without a command", () => {
    const { uv, block, regionId, changes } = bound();

    uv.previewMove(regionId, { x: 64, y: 32, width: 16, height: 16 });

    assert.deepEqual(uvOf(block, 1), [80 / TEXTURE_SIZE.x, 1 - (32 / TEXTURE_SIZE.y)]);
    assert.deepEqual(uv.get(regionId)?.geometryFor("front"), { x: 0, y: 0, width: 16, height: 16 });
    assert.deepEqual(changes, []);
  });

  test("writes a rotated region, turning each face's UVs a quarter clockwise", () => {
    const { document, uv, block, regionId } = bound();

    uv.rotate(regionId, "cw");

    assert.deepEqual(uvOf(block, 0), [16 / TEXTURE_SIZE.x, 1]);
    assert.deepEqual(uvOf(block, 1), [16 / TEXTURE_SIZE.x, 1 - (16 / TEXTURE_SIZE.y)]);
    assert.deepEqual(
      document.tree.block(block.uuid)?.uv,
      {
        state: "stacked",
        rect: { x: 0, y: 0, width: 16, height: 16, rotation: 1 }
      }
    );
  });

  test("applies a peer's in-progress drag without touching the region, and asks for a frame", () => {
    const { uv, block, regionId, textures, frames } = bound();
    const moved = uv.get(regionId)!.movedTo({ x: 64, y: 32 });

    textures.previewPeerDrag(moved);

    assert.deepEqual(uvOf(block, 1), [80 / TEXTURE_SIZE.x, 1 - (32 / TEXTURE_SIZE.y)]);
    assert.deepEqual(uv.get(regionId)?.geometryFor("front"), { x: 0, y: 0, width: 16, height: 16 });
    assert.equal(frames.requested, 1);
  });

  test("applies a peer's in-progress net resize without touching the region", () => {
    const { uv, block, regionId, textures } = bound();
    const stored = uv.get(regionId)!;
    const resized = stored.resized({ x: 0, y: 0, width: 24, height: 16 }, "front");

    textures.previewPeerDrag(resized);

    assert.deepEqual(uvOf(block, 1), [24 / TEXTURE_SIZE.x, 1]);
    assert.equal(uv.get(regionId), stored);
  });

  test("ignores regions and peer drags that belong to no block", () => {
    const { uv, block, textures, changes } = bound();
    const before = uvOf(block, 1);
    uv.create({ id: "unrelated-region", width: 16, height: 16 });

    uv.move("unrelated-region", { x: 8, y: 8, width: 16, height: 16 });
    textures.previewPeerDrag(new UVRegion({
      id: "block-missing",
      color: "#000000",
      state: "stacked",
      rect: { x: 0, y: 0, width: 16, height: 16 }
    }));

    assert.deepEqual(changes, []);
    assert.deepEqual(uvOf(block, 1), before);
  });

  test("keeps each face on its own region and reflects the block, for an X mirror", () => {
    const { document, uv, block, regionId } = bound();
    uv.setState(regionId, "free");
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 }, "right");
    uv.move(regionId, { x: 100, y: 0, width: 16, height: 16 }, "left");

    document.transform(block.uuid, block.transform, { x: true, y: false, z: false });

    assert.equal(uvOf(block, 0)[0], 0);
    assert.equal(uvOf(block, 4)[0], 100 / TEXTURE_SIZE.x);
    assert.ok(block.mesh.geometry.getAttribute("position").getX(0) < 0);
  });

  test("honors flipAxes already recorded on first mapping", () => {
    const { document, blocks, uv, regionId, block } = bound();
    uv.setState(regionId, "free");
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 }, "right");
    uv.move(regionId, { x: 100, y: 0, width: 16, height: 16 }, "left");

    document.apply({
      action: "node-added",
      node: {
        kind: "block",
        id: "mirrored",
        parentId: null,
        name: "Mirrored",
        transform: BlockTransform.create(),
        flipAxes: { x: true, y: false, z: false },
        uv: document.tree.block(block.uuid)!.uv
      }
    });

    const mirrored = blocks.get("mirrored");
    assert.ok(mirrored);
    assert.equal(uvOf(mirrored, 0)[0], 0);
    assert.equal(uvOf(mirrored, 4)[0], 100 / TEXTURE_SIZE.x);
    assert.ok(mirrored.mesh.geometry.getAttribute("position").getX(0) < 0);
  });
});
