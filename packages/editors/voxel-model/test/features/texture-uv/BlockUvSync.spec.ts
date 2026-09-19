// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  DEFAULT_UV_SLOTS,
  UVMap,
  type PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import BlockUvSync from "#src/features/texture-uv/BlockUvSync.ts";
import ModelManager from "#src/features/groups/ModelManager.ts";
import type { ModelSceneComponent } from "#src/app/ModelSceneComponent.ts";

// CONSTANTS
const kTextureSize = { x: 256, y: 256 };

function createModelManager(): ModelManager {
  const scene = new THREE.Scene();
  const transformControl = {
    attach: () => undefined,
    detach: () => undefined,
    getHelper: () => new THREE.Object3D()
  } as unknown as TransformControls;

  return new ModelManager({ scene, transformControl });
}

function createHarness() {
  const modelManager = createModelManager();
  const uv = new UVMap({ getCanvasSize: () => kTextureSize });
  const canvasManager = {
    uv,
    textureSize: kTextureSize
  } as unknown as PixelArtCanvas;

  const modelSceneComponent = {
    getModelManager: () => modelManager,
    setCanvasTexture: () => undefined
  } as unknown as ModelSceneComponent;

  const sync = new BlockUvSync({
    modelSceneComponent,
    getCanvasManager: () => canvasManager
  });

  return {
    modelManager,
    uv,
    sync
  };
}

describe("BlockUvSync region reconciliation", () => {
  test("maps an existing region onto a block's mesh once both are present", () => {
    const { modelManager, uv, sync } = createHarness();
    const group = modelManager.addGroup({ name: "Block" });
    uv.create({
      id: `block-${group.getGroupUUID()}`,
      width: 16,
      height: 16
    });
    uv.move(`block-${group.getGroupUUID()}`, { x: 0, y: 0, width: 16, height: 16 });

    sync.update();

    const attribute = group.getMesh().geometry.attributes.uv;
    assert.equal(attribute.getX(1), 16 / kTextureSize.x);
    assert.equal(attribute.getY(1), 1);
  });

  test("honors flipAxes already on the model manager on first mapping", () => {
    const { modelManager, uv, sync } = createHarness();
    const group = modelManager.addGroup({ name: "Block" });
    const regionId = `block-${group.getGroupUUID()}`;

    modelManager.setFlipAxes(group.getGroupUUID(), { x: true, y: false, z: false });

    uv.create({
      id: regionId,
      width: 16,
      height: 16,
      state: "free",
      activeSlots: DEFAULT_UV_SLOTS
    });
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 }, "right");
    uv.move(regionId, { x: 100, y: 0, width: 16, height: 16 }, "left");

    sync.update();

    const attribute = group.getMesh().geometry.attributes.uv;
    assert.equal(attribute.getX(0), 100 / kTextureSize.x);
    assert.equal(attribute.getX(16), 16 / kTextureSize.x);
  });
});

describe("BlockUvSync live region updates", () => {
  test("re-applies the region to the block's mesh when it moves, without waiting for reconciliation", () => {
    const { modelManager, uv, sync } = createHarness();
    const group = modelManager.addGroup({ name: "Block" });
    const regionId = `block-${group.getGroupUUID()}`;
    uv.create({ id: regionId, width: 16, height: 16 });
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 });
    sync.update();

    uv.move(regionId, { x: 64, y: 32, width: 16, height: 16 });

    const attribute = group.getMesh().geometry.attributes.uv;
    assert.equal(attribute.getX(1), 80 / kTextureSize.x);
    assert.equal(attribute.getY(1), 1 - (32 / kTextureSize.y));
  });

  test("re-applies the region to the block's mesh while it is still being dragged", () => {
    const { modelManager, uv, sync } = createHarness();
    const group = modelManager.addGroup({ name: "Block" });
    const regionId = `block-${group.getGroupUUID()}`;
    uv.create({ id: regionId, width: 16, height: 16 });
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 });
    sync.update();

    uv.previewMove(regionId, { x: 64, y: 32, width: 16, height: 16 });

    const attribute = group.getMesh().geometry.attributes.uv;
    assert.equal(attribute.getX(1), 80 / kTextureSize.x);
    assert.equal(attribute.getY(1), 1 - (32 / kTextureSize.y));

    const geometry = uv.get(regionId)?.geometryFor("front");
    assert.deepEqual(geometry, { x: 0, y: 0, width: 16, height: 16 });
  });

  test("re-applies a rotated region, turning each face's UVs a quarter clockwise", () => {
    const { modelManager, uv, sync } = createHarness();
    const group = modelManager.addGroup({ name: "Block" });
    const regionId = `block-${group.getGroupUUID()}`;
    uv.create({ id: regionId, width: 16, height: 16 });
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 });
    sync.update();

    uv.rotate(regionId, "cw");

    const attribute = group.getMesh().geometry.attributes.uv;
    assert.equal(attribute.getX(0), 16 / kTextureSize.x);
    assert.equal(attribute.getY(0), 1);
    assert.equal(attribute.getX(1), 16 / kTextureSize.x);
    assert.equal(attribute.getY(1), 1 - (16 / kTextureSize.y));
  });

  test("ignores a moved region that does not belong to any block", () => {
    const { uv, sync } = createHarness();
    sync.update();
    uv.create({ id: "unrelated-region", width: 16, height: 16 });

    assert.doesNotThrow(
      () => uv.move("unrelated-region", { x: 8, y: 8, width: 16, height: 16 })
    );
  });
});

describe("BlockUvSync.duplicateBlock", () => {
  test("clones the source block's region geometry onto the duplicate", () => {
    const { modelManager, uv, sync } = createHarness();
    const source = modelManager.addGroup({ name: "Block" });
    const duplicate = modelManager.addGroup({ name: "Block Copy" });
    const sourceRegionId = `block-${source.getGroupUUID()}`;
    const duplicateRegionId = `block-${duplicate.getGroupUUID()}`;

    uv.create({ id: sourceRegionId, width: 16, height: 16 });
    uv.move(sourceRegionId, { x: 64, y: 32, width: 16, height: 16 });

    sync.duplicateBlock(source.getGroupUUID(), duplicate.getGroupUUID(), "Block Copy");
    sync.update();

    const attribute = duplicate.getMesh().geometry.attributes.uv;
    assert.equal(attribute.getX(1), 80 / kTextureSize.x);
    assert.equal(attribute.getY(1), 1 - (32 / kTextureSize.y));
    assert.equal(uv.get(duplicateRegionId)?.name, "Block Copy");
  });

  test("creates a default region for the duplicate when the source has none", () => {
    const { modelManager, uv, sync } = createHarness();
    const source = modelManager.addGroup({ name: "Block" });
    const duplicate = modelManager.addGroup({ name: "Block Copy" });
    const duplicateRegionId = `block-${duplicate.getGroupUUID()}`;

    sync.duplicateBlock(source.getGroupUUID(), duplicate.getGroupUUID(), "Block Copy");

    assert.ok(uv.get(duplicateRegionId));
  });
});

describe("BlockUvSync.refreshFlipAxes", () => {
  test("swaps the axis-perpendicular faces and mirrors U on the rest, for an X mirror", () => {
    const { modelManager, uv, sync } = createHarness();
    const group = modelManager.addGroup({ name: "Block" });
    const regionId = `block-${group.getGroupUUID()}`;

    uv.create({
      id: regionId,
      width: 16,
      height: 16,
      state: "free",
      activeSlots: DEFAULT_UV_SLOTS
    });
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 }, "right");
    uv.move(regionId, { x: 100, y: 0, width: 16, height: 16 }, "left");
    uv.move(regionId, { x: 0, y: 100, width: 16, height: 16 }, "front");
    sync.update();

    modelManager.setFlipAxes(group.getGroupUUID(), { x: true, y: false, z: false });
    sync.refreshFlipAxes(group.getGroupUUID());

    const attribute = group.getMesh().geometry.attributes.uv;
    assert.equal(attribute.getX(0), 100 / kTextureSize.x);
    assert.equal(attribute.getX(1), 116 / kTextureSize.x);
    assert.equal(attribute.getX(16), 16 / kTextureSize.x);
    assert.equal(attribute.getX(17), 0);
  });
});

describe("BlockUvSync.applyPeerDragPreview", () => {
  test("re-applies a remote peer's in-progress drag onto the block's mesh", () => {
    const { modelManager, uv, sync } = createHarness();
    const group = modelManager.addGroup({ name: "Block" });
    const regionId = `block-${group.getGroupUUID()}`;
    uv.create({ id: regionId, width: 16, height: 16 });
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 });
    sync.update();

    sync.applyPeerDragPreview({
      id: regionId,
      face: null,
      geometry: { x: 64, y: 32, width: 16, height: 16 }
    });

    const attribute = group.getMesh().geometry.attributes.uv;
    assert.equal(attribute.getX(1), 80 / kTextureSize.x);
    assert.equal(attribute.getY(1), 1 - (32 / kTextureSize.y));

    const geometry = uv.get(regionId)?.geometryFor("front");
    assert.deepEqual(geometry, { x: 0, y: 0, width: 16, height: 16 });
  });

  test("ignores a peer drag for a region that does not exist locally yet", () => {
    const { sync } = createHarness();
    sync.update();

    assert.doesNotThrow(() => sync.applyPeerDragPreview({
      id: "block-missing",
      face: null,
      geometry: { x: 0, y: 0, width: 16, height: 16 }
    }));
  });
});
