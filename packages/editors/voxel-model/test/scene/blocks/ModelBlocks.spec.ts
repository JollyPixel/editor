// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockUvLayouts,
  MaterialSurface
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { createModelFixture } from "../../fixtures/model.ts";
import { transformAt } from "./blockHelpers.ts";

// CONSTANTS
const kMetal = MaterialSurface.create({ metalness: 0.8 });

describe("ModelBlocks projection", () => {
  test("mirrors the blocks of the document it is built over", () => {
    const fixture = createModelFixture();
    const id = fixture.document.addBlock({
      name: "Torso",
      transform: transformAt({ x: 1, y: 2, z: 3 })
    });
    fixture.document.addFolder({ name: "Limbs" });

    const block = fixture.blocks.get(id!);

    assert.equal(fixture.blocks.size, 1);
    assert.equal(block?.name, "Torso");
    assert.deepEqual(block?.transform, transformAt({ x: 1, y: 2, z: 3 }));
    assert.equal(block?.node.parent, fixture.scene);
  });

  test("parents a block to the pivot of its nearest block, through folders", () => {
    const fixture = createModelFixture();
    const body = fixture.addBlock({ name: "Body" });
    const folderId = fixture.document.addFolder({
      name: "Limbs",
      parentId: body.uuid
    });
    const arm = fixture.addBlock({
      name: "Arm",
      parentId: folderId
    });

    assert.equal(arm.node.parent, body.node);
  });

  test("follows renames, transforms and removals of either origin", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock({ name: "Arm" });

    fixture.document.rename(block.uuid, "Leg");
    fixture.document.applyRemote({
      action: "node-transformed",
      id: block.uuid,
      transform: transformAt({ x: 4, y: 0, z: 0 })
    });

    assert.equal(block.name, "Leg");
    assert.equal(block.position.x, 4);

    fixture.document.remove(block.uuid);

    assert.equal(fixture.blocks.get(block.uuid), undefined);
    assert.equal(block.node.parent, null);
  });

  test("drops the views of a whole removed subtree", () => {
    const fixture = createModelFixture();
    const folderId = fixture.document.addFolder({ name: "Limbs" });
    const arm = fixture.addBlock({ parentId: folderId });
    const hand = fixture.addBlock({ parentId: arm.uuid });

    fixture.document.remove(folderId!);

    assert.equal(fixture.blocks.size, 0);
    assert.equal(hand.node.parent, null);
  });

  test("re-parents the blocks a moved folder carries and applies their transforms", () => {
    const fixture = createModelFixture();
    const body = fixture.addBlock({ name: "Body" });
    const folderId = fixture.document.addFolder({ name: "Limbs" });
    const arm = fixture.addBlock({ parentId: folderId });

    fixture.document.move(folderId!, body.uuid, {
      transforms: [
        { id: arm.uuid, transform: transformAt({ x: -2, y: 0, z: 0 }) }
      ]
    });

    assert.equal(arm.node.parent, body.node);
    assert.equal(arm.position.x, -2);
  });

  test("rebuilds every view on a reset, parenting nodes in any order", () => {
    const fixture = createModelFixture();
    const stale = fixture.addBlock();

    fixture.document.load({
      nodes: [
        {
          kind: "block",
          id: "child",
          parentId: "parent",
          name: "Child",
          transform: transformAt({ x: 1, y: 0, z: 0 }),
          uv: BlockUvLayouts.net(),
          materialId: "metal"
        },
        {
          kind: "block",
          id: "parent",
          parentId: null,
          name: "Parent",
          transform: transformAt({ x: 0, y: 0, z: 0 }),
          uv: BlockUvLayouts.net()
        }
      ],
      materials: [
        {
          kind: "material",
          id: "metal",
          parentId: null,
          name: "Metal",
          surface: kMetal
        }
      ],
      animationSets: []
    });

    assert.equal(fixture.blocks.get(stale.uuid), undefined);
    assert.equal(fixture.blocks.size, 2);
    assert.deepEqual(fixture.blocks.get("child")?.surface, kMetal);
    assert.equal(fixture.blocks.get("parent")?.surface, null);
    assert.equal(
      fixture.blocks.get("child")?.node.parent,
      fixture.blocks.get("parent")?.node
    );
  });

  test("stops following the document once disposed", () => {
    const fixture = createModelFixture();
    fixture.blocks.dispose();

    fixture.document.addBlock({ name: "Late" });

    assert.equal(fixture.blocks.size, 0);
  });
});

describe("ModelBlocks surface previews", () => {
  test("shows a material's previews on its blocks and keeps them over a commit", () => {
    const { document, previews, addBlock } = createModelFixture();
    const glass = document.addMaterial({ name: "Glass" })!;
    const block = addBlock({ materialId: glass });

    previews.set(glass, "bob", { roughness: 0.3 });
    assert.deepEqual(block.surface, MaterialSurface.create({ roughness: 0.3 }));

    document.changeMaterial(glass, { opacity: 0.5 });
    assert.deepEqual(
      block.surface,
      MaterialSurface.create({ opacity: 0.5, roughness: 0.3 })
    );

    previews.end(glass, "bob");
    assert.deepEqual(block.surface, MaterialSurface.create({ opacity: 0.5 }));
  });

  test("dresses a block newly given a material with the material's previews", () => {
    const { document, previews, addBlock } = createModelFixture();
    const glass = document.addMaterial({ name: "Glass" })!;
    const block = addBlock();

    previews.set(glass, "bob", { roughness: 0.3 });
    document.assignMaterial(block.uuid, glass);

    assert.deepEqual(block.surface, MaterialSurface.create({ roughness: 0.3 }));
  });

  test("shows the default surface once a block's material is removed", () => {
    const { document, addBlock } = createModelFixture();
    const glass = document.addMaterial({
      name: "Glass",
      surface: MaterialSurface.create({ opacity: 0.5 })
    })!;
    const block = addBlock({ materialId: glass });

    document.removeMaterial(glass);

    assert.equal(block.surface, null);
  });
});

describe("ModelBlocks glow", () => {
  test("glows while a shown block has a glowing surface, previews included", () => {
    const { document, previews, blocks, addBlock } = createModelFixture();
    const lamp = document.addMaterial({ name: "Lamp" })!;
    const block = addBlock({ materialId: lamp });
    assert.equal(blocks.glows, false);

    previews.set(lamp, "bob", { emissive: "#ffcc66" });
    assert.equal(blocks.glows, true);

    previews.end(lamp, "bob");
    assert.equal(blocks.glows, false);

    document.changeMaterial(lamp, { emissive: "#ffcc66" });
    addBlock({ materialId: lamp });
    document.remove(block.uuid);
    assert.equal(blocks.glows, true);

    document.changeMaterial(lamp, { emissiveIntensity: 0 });
    assert.equal(blocks.glows, false);
  });
});

describe("ModelBlocks selection", () => {
  test("removing the selected and hovered block clears both marks", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();
    fixture.selection.select(block.uuid);
    fixture.selection.hover(block.uuid);

    fixture.document.remove(block.uuid);

    assert.equal(fixture.selection.selected, null);
    assert.equal(fixture.selection.hovered, null);
  });

  test("fromMesh resolves a block from its mesh only", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();

    assert.equal(fixture.blocks.fromMesh(block.mesh), block);
    assert.equal(fixture.blocks.fromMesh(block.node), undefined);
  });
});

describe("ModelBlocks textures", () => {
  test("applies the shared texture to existing and future blocks", () => {
    const fixture = createModelFixture();
    const existing = fixture.addBlock();
    const texture = new THREE.Texture();

    fixture.blocks.texture = texture;
    const future = fixture.addBlock();

    assert.equal(existing.texture, texture);
    assert.equal(future.texture, texture);
  });
});

describe("ModelBlocks shading", () => {
  test("gives existing and future blocks of the same surface one shader cache key", () => {
    const fixture = createModelFixture();
    const existing = fixture.addBlock();

    fixture.blocks.lit = false;
    const future = fixture.addBlock();

    assert.equal(fixture.blocks.lit, false);
    assert.equal(
      existing.mesh.material.customProgramCacheKey(),
      future.mesh.material.customProgramCacheKey()
    );
  });
});
