// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import {
  BlockTransform,
  BlockUvLayouts
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { BlockTextures } from "#src/features/texture/BlockTextures.ts";
import { createModelFixture } from "../../fixtures/model.ts";
import { modelAccess } from "../../fixtures/modelAccess.ts";
import {
  TEXTURE_SIZE,
  TORSO_REGION_ID,
  createTextureHarness,
  readRegionId,
  stackedAt,
  torsoSnapshot,
  readUv
} from "./textureHarness.ts";

describe("BlockTextures texture", () => {
  test("shares one texture across existing and future blocks", () => {
    const pixels = new PixelDocument({ size: TEXTURE_SIZE });
    const { document, blocks, selection, addBlock } = createModelFixture();
    const before = addBlock();
    new BlockTextures({
      pixels,
      document,
      blocks,
      selection,
      access: modelAccess()
    });
    const after = addBlock();

    assert.ok(before.texture);
    assert.equal(after.texture, before.texture);
  });

  test("owns block regions while attached and gives them back on dispose", () => {
    const { pixels, textures } = createTextureHarness();
    const regionId = "block-a";

    assert.equal(pixels.ownsUvRegion(regionId), false);
    assert.equal(pixels.ownsUvRegion("texture-region"), true);
    textures.dispose();
    assert.equal(pixels.ownsUvRegion(regionId), true);
  });

  test("keeps syncing the texture's own regions", () => {
    const { pixels, pixelEvents } = createTextureHarness();

    pixels.uv.create({
      id: "texture-region",
      width: 4,
      height: 4
    });

    assert.deepEqual(
      pixelEvents.map((event) => event.action),
      ["uv-region-created"]
    );
  });
});

describe("BlockTextures model layouts", () => {
  test("maps a block's stored UV layout onto the mesh", () => {
    const { addBlock, uv } = createTextureHarness();
    const block = addBlock({ uv: stackedAt(0) });

    assert.equal(uv.get(readRegionId(block))?.name, "Block");
    assert.deepEqual(readUv(block, 1), [16 / TEXTURE_SIZE.x, 1]);
  });

  test("maps a remote block added with its UV layout", () => {
    const { document, blocks } = createTextureHarness();

    document.apply({
      action: "node-added",
      node: {
        kind: "block",
        id: "late",
        parentId: null,
        name: "Late",
        transform: BlockTransform.create(),
        uv: stackedAt(32)
      }
    });

    const block = blocks.get("late");
    assert.ok(block);
    assert.deepEqual(readUv(block, 1), [48 / TEXTURE_SIZE.x, 1]);
  });

  test("rebinds a reshaped block's new mesh to the layout that came with the shape", () => {
    const { addBlock, document, uv } = createTextureHarness();
    const block = addBlock({ uv: stackedAt(0) });
    const plane = { type: "plane" } as const;

    document.updateShape(block.uuid, plane, BlockUvLayouts.net({ x: 32, y: 0 }, plane));

    assert.deepEqual(uv.get(readRegionId(block))?.slots, ["top"]);
    assert.deepEqual(readUv(block, 1), [48 / TEXTURE_SIZE.x, 1]);
  });

  test("shows the default net of a block added without a layout", () => {
    const { addBlock, uv, changes } = createTextureHarness();
    const block = addBlock({ name: "Head" });

    assert.equal(uv.get(readRegionId(block))?.state, "unfolded");
    assert.equal(uv.get(readRegionId(block))?.name, "Head");
    assert.deepEqual(
      changes.map((change) => change.command.action),
      ["node-added"]
    );
  });

  test("binds the layout of a snapshot block", () => {
    const { document, blocks, uv } = createTextureHarness();
    document.load(torsoSnapshot(BlockUvLayouts.net()));

    assert.equal(uv.get(TORSO_REGION_ID)?.name, "Torso");

    const block = blocks.get("torso");
    assert.ok(block);
    uv.move(TORSO_REGION_ID, { x: 0, y: 0, width: 48, height: 32 });
    const [u, v] = readUv(block, 1);
    uv.move(TORSO_REGION_ID, { x: 64, y: 0, width: 48, height: 32 });

    assert.deepEqual(readUv(block, 1), [u + (64 / TEXTURE_SIZE.x), v]);
  });

  test("the model layout wins over a region the texture carries", () => {
    const { document, uv } = createTextureHarness();
    uv.create({ id: TORSO_REGION_ID, width: 16, height: 16 });
    uv.move(TORSO_REGION_ID, { x: 64, y: 32, width: 16, height: 16 });

    document.load(torsoSnapshot(stackedAt(0)));

    assert.deepEqual(
      uv.get(TORSO_REGION_ID)?.slotGeometry("front"),
      { x: 0, y: 0, width: 16, height: 16 }
    );
  });

  test("updates the regions of blocks a reset keeps, without re-creating them", () => {
    const { document, uv } = createTextureHarness();
    document.load(torsoSnapshot(stackedAt(0)));
    const deleted: string[] = [];
    uv.on("region-deleted", ({ region }) => deleted.push(region.id));

    document.load(torsoSnapshot(stackedAt(32)));

    assert.deepEqual(deleted, []);
    assert.deepEqual(
      uv.get(TORSO_REGION_ID)?.slotGeometry("front"),
      { x: 32, y: 0, width: 16, height: 16 }
    );
  });

  test("binds a snapshot block whose region the texture already carries", () => {
    const { document, blocks, uv } = createTextureHarness();
    uv.create({ id: TORSO_REGION_ID, width: 16, height: 16 });

    document.load(torsoSnapshot(stackedAt(32)));

    const block = blocks.get("torso");
    assert.ok(block);
    assert.deepEqual(readUv(block, 1), [48 / TEXTURE_SIZE.x, 1]);
  });

  test("binds the meshes a second snapshot re-creates", () => {
    const { document, blocks } = createTextureHarness();
    document.load(torsoSnapshot(stackedAt(0)));

    document.load(torsoSnapshot(stackedAt(32)));

    const block = blocks.get("torso");
    assert.ok(block);
    assert.deepEqual(readUv(block, 1), [48 / TEXTURE_SIZE.x, 1]);
  });

  test("drops texture regions of blocks the model does not have", () => {
    const { document, uv } = createTextureHarness();
    uv.create({ id: "block-ghost", width: 16, height: 16 });
    uv.create({ id: "unrelated", width: 16, height: 16 });

    document.load(torsoSnapshot(stackedAt(0)));

    assert.equal(uv.get("block-ghost"), undefined);
    assert.ok(uv.get("unrelated"));
  });

  test("keeps every block region through a texture snapshot", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { pixels, addBlock, uv } = createTextureHarness();
    const block = addBlock({ uv: stackedAt(32) });

    pixels.loadSnapshot(
      TEXTURE_SIZE,
      new Uint8ClampedArray(TEXTURE_SIZE.x * TEXTURE_SIZE.y * 4)
    );

    assert.deepEqual(
      uv.get(readRegionId(block))?.slotGeometry("front"),
      { x: 32, y: 0, width: 16, height: 16 }
    );
    assert.deepEqual(readUv(block, 1), [48 / TEXTURE_SIZE.x, 1]);
  });

  test("deletes a block's region when the block is removed", () => {
    const { document, addBlock, uv } = createTextureHarness();
    const block = addBlock({ uv: stackedAt(0) });
    assert.ok(uv.get(readRegionId(block)));

    document.remove(block.uuid);

    assert.equal(uv.get(readRegionId(block)), undefined);
  });
});

describe("BlockTextures rename", () => {
  test("a local block rename renames its region in place", () => {
    const { document, addBlock, uv } = createTextureHarness();
    const block = addBlock({ name: "Torso", uv: stackedAt(32) });
    const before = uv.get(readRegionId(block))?.toJSON();
    assert.ok(before);

    document.rename(block.uuid, "Chest");

    assert.deepEqual(
      uv.get(readRegionId(block))?.toJSON(),
      { ...before, name: "Chest" }
    );
  });

  test("a remote block rename renames its region too", () => {
    const { document, addBlock, uv } = createTextureHarness();
    const block = addBlock({ name: "Torso", uv: stackedAt(0) });

    document.apply({
      action: "node-renamed",
      id: block.uuid,
      name: "Chest"
    });

    assert.equal(block.name, "Chest");
    assert.equal(uv.get(readRegionId(block))?.name, "Chest");
  });

  test("keeps the renamed region mapped onto the mesh", () => {
    const { document, addBlock, uv } = createTextureHarness();
    const block = addBlock({ name: "Torso", uv: stackedAt(0) });
    document.rename(block.uuid, "Chest");

    uv.move(readRegionId(block), { x: 32, y: 0, width: 16, height: 16 });

    assert.deepEqual(readUv(block, 1), [48 / TEXTURE_SIZE.x, 1]);
  });
});

describe("BlockTextures selection", () => {
  test("selecting a block selects its region, and the reverse", () => {
    const { selection, addBlock, uv } = createTextureHarness();
    const first = addBlock({ uv: stackedAt(0) });
    const second = addBlock({ uv: stackedAt(32) });

    selection.select(first.uuid);
    assert.equal(uv.selectedRegionId, readRegionId(first));

    uv.select(readRegionId(second));
    assert.equal(selection.selected, second.uuid);
  });
});
