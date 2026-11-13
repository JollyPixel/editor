// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockTransform,
  BlockUvLayouts,
  MaterialSurface,
  ModelDocument,
  type BlockShapeJSON
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { ModelView } from "#src/viewer/ModelView.ts";
import type { BlockMesh } from "#src/scene/blocks/BlockBody.ts";
import { stackedAt } from "../features/texture/textureHarness.ts";
import { transformAt } from "../scene/blocks/blockHelpers.ts";

// CONSTANTS
const kTextureSize = { x: 256, y: 256 };
const kPlane: BlockShapeJSON = { type: "plane" };

function createView() {
  const document = new ModelDocument();
  const frames = { requested: 0 };
  const texture = {
    map: new THREE.Texture(),
    size: () => kTextureSize
  };
  const view = new ModelView({
    document,
    texture,
    requestFrame: () => frames.requested++
  });

  return { document, view, frames, texture };
}

function blockNode(
  view: ModelView,
  id: string
): THREE.Object3D | undefined {
  return view.root.getObjectByProperty("uuid", id);
}

function blockMesh(
  view: ModelView,
  id: string
): BlockMesh {
  const mesh = blockNode(view, id)?.children[0];
  assert.ok(mesh instanceof THREE.Mesh, `no mesh for block ${id}`);

  return mesh as BlockMesh;
}

function readU(
  mesh: BlockMesh
): number {
  return mesh.geometry.getAttribute("uv").getX(0);
}

describe("ModelView", () => {
  test("draws each block under the nearest enclosing block, through folders", () => {
    const { document, view } = createView();
    const body = document.addBlock({ name: "Body" })!;
    const limbs = document.addFolder({ name: "Limbs", parentId: body })!;
    const arm = document.addBlock({ name: "Arm", parentId: limbs })!;

    assert.equal(blockNode(view, body)?.parent, view.root);
    assert.equal(blockNode(view, arm)?.parent, blockNode(view, body));
    assert.equal(blockNode(view, limbs), undefined);
  });

  test("follows transforms, shapes and removals from either origin", () => {
    const { document, view, frames } = createView();
    const id = document.addBlock({ name: "Arm" })!;
    const geometry = blockMesh(view, id).geometry;
    frames.requested = 0;

    document.applyRemote({
      action: "node-transformed",
      id,
      transform: BlockTransform.create({
        position: { x: 4, y: 0, z: 0 },
        pivotOffset: { x: 0, y: 1, z: 0 }
      })
    });
    document.updateShape(id, kPlane, BlockUvLayouts.net(undefined, kPlane));

    assert.equal(blockNode(view, id)?.position.x, 4);
    assert.equal(blockMesh(view, id).position.y, -1);
    assert.notEqual(blockMesh(view, id).geometry, geometry);
    assert.equal(frames.requested, 2);

    document.remove(id);

    assert.equal(blockNode(view, id), undefined);
  });

  test("paints a block with its material, and the default surface without one", () => {
    const { document, view } = createView();
    const glass = document.addMaterial({
      name: "Glass",
      surface: MaterialSurface.create({ opacity: 0.5 })
    })!;
    const id = document.addBlock({ name: "Pane", materialId: glass })!;
    const { material } = blockMesh(view, id);

    assert.equal(material.opacity, 0.5);
    assert.equal(material.transparent, true);

    document.changeMaterial(glass, { roughness: 0.25 });
    assert.equal(material.roughness, 0.25);

    document.removeMaterial(glass);
    assert.equal(material.opacity, 1);
    assert.equal(material.transparent, false);
  });

  test("maps block UVs into the texture, through UV edits and shape changes", () => {
    const { document, view, texture } = createView();
    const id = document.addBlock({ name: "Torso", uv: stackedAt(16) })!;
    const mesh = blockMesh(view, id);

    assert.equal(mesh.material.map, texture.map);
    assert.ok(readU(mesh) >= 16 / 256 && readU(mesh) <= 32 / 256);

    document.updateUv(id, stackedAt(64));
    assert.ok(readU(mesh) >= 64 / 256 && readU(mesh) <= 80 / 256);

    document.updateShape(id, kPlane, stackedAt(128));
    assert.ok(readU(mesh) >= 128 / 256 && readU(mesh) <= 144 / 256);
  });

  test("rebuilds every block on a reset, parenting nodes in any order", () => {
    const { document, view } = createView();
    const stale = document.addBlock({ name: "Stale" })!;

    document.load({
      nodes: [
        {
          kind: "block",
          id: "child",
          parentId: "parent",
          name: "Child",
          transform: transformAt({ x: 1, y: 0, z: 0 }),
          flipAxes: { x: false, y: false, z: false },
          shape: { type: "box" },
          uv: BlockUvLayouts.net()
        },
        {
          kind: "block",
          id: "parent",
          parentId: null,
          name: "Parent",
          transform: transformAt({ x: 0, y: 0, z: 0 }),
          flipAxes: { x: false, y: false, z: false },
          shape: { type: "box" },
          uv: BlockUvLayouts.net()
        }
      ],
      materials: [],
      animationSets: []
    });

    assert.equal(blockNode(view, stale), undefined);
    assert.equal(blockNode(view, "child")?.parent, blockNode(view, "parent"));
  });

  test("applies its shadow settings to current and later blocks", () => {
    const { document, view } = createView();
    const before = document.addBlock({ name: "Before" })!;

    view.castShadow = true;
    view.receiveShadow = true;
    const after = document.addBlock({ name: "After" })!;

    for (const id of [before, after]) {
      assert.equal(blockMesh(view, id).castShadow, true);
      assert.equal(blockMesh(view, id).receiveShadow, true);
    }
  });

  test("stops following the document once disposed", () => {
    const { document, view } = createView();
    const parent = new THREE.Group();
    parent.add(view.root);
    document.addBlock({ name: "Early" });

    view.dispose();
    document.addBlock({ name: "Late" });

    assert.equal(view.root.children.length, 0);
    assert.equal(view.root.parent, null);
  });
});
