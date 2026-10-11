// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { MaterialSurface } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { ModelBlock } from "#src/scene/blocks/ModelBlock.ts";
import { NEUTRAL_HIGHLIGHT_COLOR } from "#src/scene/blocks/PivotMarker.ts";

type TexturedMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardNodeMaterial>;

function pivotMarkerOf(
  block: ModelBlock
): THREE.Sprite | undefined {
  return block.node.children.find(
    (child): child is THREE.Sprite => child.name === "pivot_visual"
  );
}

function textureGhostOf(
  block: ModelBlock
): TexturedMesh | undefined {
  return block.mesh.children.find(
    (child): child is TexturedMesh => child.name === "selection-texture-ghost"
  );
}

describe("ModelBlock selection ghost", () => {
  test("adds a dimmed front-face duplicate drawn only where occluded", () => {
    const block = new ModelBlock();

    block.showSelectionGhost();

    const ghost = textureGhostOf(block);
    assert.equal(ghost?.material.side, THREE.FrontSide);
    assert.equal(ghost?.material.depthTest, true);
    assert.equal(ghost?.material.depthFunc, THREE.GreaterDepth);
    assert.equal(ghost?.material.depthWrite, false);
    assert.equal(ghost?.material.opacity, 0.35);
    assert.equal(ghost?.geometry, block.mesh.geometry);
  });

  test("keeps a single ghost when shown twice", () => {
    const block = new ModelBlock();

    block.showSelectionGhost();
    const first = textureGhostOf(block);
    block.showSelectionGhost();

    assert.equal(textureGhostOf(block), first);
  });

  test("is removed on hide", () => {
    const block = new ModelBlock();
    block.showSelectionGhost();
    const ghost = textureGhostOf(block);

    block.hideSelectionGhost();

    assert.equal(textureGhostOf(block), undefined);
    assert.equal(ghost?.parent, null);
  });

  test("follows texture changes while shown", () => {
    const block = new ModelBlock();
    block.showSelectionGhost();
    const texture = new THREE.Texture();

    block.texture = texture;

    assert.equal(textureGhostOf(block)?.material.map, texture);
  });

  test("takes the block material while shown", () => {
    const block = new ModelBlock();
    block.showSelectionGhost();

    block.surface = MaterialSurface.create({
      opacity: 0.5,
      metalness: 0.7
    });

    const ghost = textureGhostOf(block);
    assert.equal(ghost?.material.opacity, 0.5 * 0.35);
    assert.equal(ghost?.material.metalness, 0.7);
    assert.equal(ghost?.material.depthFunc, THREE.GreaterDepth);
  });

  test("repaints material values in place, without rebuilding any shader", () => {
    const block = new ModelBlock();
    block.showSelectionGhost();
    const ghostMaterial = textureGhostOf(block)?.material;
    const versions = [block.mesh.material.version, ghostMaterial?.version];

    block.surface = MaterialSurface.create({
      color: "#336699",
      roughness: 0.2,
      metalness: 0.5
    });

    assert.ok(textureGhostOf(block)?.material === ghostMaterial);
    assert.deepEqual(
      [block.mesh.material.version, ghostMaterial?.version],
      versions
    );
  });

  test("emphasize does not create a ghost", () => {
    const block = new ModelBlock();

    block.emphasize(0x00ff00);

    assert.equal(textureGhostOf(block), undefined);
  });
});

describe("ModelBlock material", () => {
  test("renders a material and falls back to the default look without one", () => {
    const block = new ModelBlock();
    const surface = MaterialSurface.create({
      color: "#ff0000",
      opacity: 0.4,
      roughness: 0.2,
      emissive: "#00ff00",
      emissiveIntensity: 2
    });

    block.surface = surface;

    const target = block.mesh.material;
    assert.deepEqual(block.surface, surface);
    assert.equal(target.color.getHexString(), "ff0000");
    assert.equal(target.opacity, 0.4);
    assert.equal(target.transparent, true);
    assert.equal(target.depthWrite, false);
    assert.equal(target.roughness, 0.2);
    assert.equal(target.emissive.getHexString(), "00ff00");
    assert.equal(target.emissiveIntensity, 2);

    block.surface = null;

    assert.equal(block.surface, null);
    assert.equal(target.color.getHexString(), "ffffff");
    assert.equal(target.opacity, 1);
    assert.equal(target.transparent, false);
    assert.equal(target.depthWrite, true);
    assert.equal(target.roughness, 1);
  });
});

describe("ModelBlock shading", () => {
  test("is lit by default and passes flat shading to its selection ghost", () => {
    const block = new ModelBlock();
    block.showSelectionGhost();

    assert.equal(block.lit, true);

    block.lit = false;

    assert.equal(block.mesh.material.lights, false);
    assert.equal(textureGhostOf(block)?.material.lights, false);
  });
});

describe("ModelBlock emphasis", () => {
  test("shows and tints the pivot marker on emphasize, hides it again on clear", () => {
    const block = new ModelBlock();
    assert.equal(pivotMarkerOf(block)?.visible, false);

    block.emphasize(0x00ff00);
    assert.equal(pivotMarkerOf(block)?.visible, true);
    assert.equal(pivotMarkerOf(block)?.material.color.getHex(), 0x00ff00);

    block.clearEmphasis();
    assert.equal(pivotMarkerOf(block)?.visible, false);
  });

  test("keeps the local pivot marker visible after a peer's emphasis clears", () => {
    const block = new ModelBlock();

    block.pivotMarkerVisible = true;
    block.emphasize(0x00ff00, "bob");
    block.clearEmphasis("bob");

    assert.equal(block.pivotMarkerVisible, true);
    assert.equal(pivotMarkerOf(block)?.visible, true);
    assert.equal(pivotMarkerOf(block)?.material.color.getHex(), NEUTRAL_HIGHLIGHT_COLOR);
  });

  test("falls back to the remaining peer's color when one of two peers clears", () => {
    const block = new ModelBlock();

    block.emphasize(0xff0000, "bob");
    block.emphasize(0x0000ff, "cleo");
    block.clearEmphasis("cleo");

    assert.equal(pivotMarkerOf(block)?.material.color.getHex(), 0xff0000);

    block.clearEmphasis("bob");
    assert.equal(pivotMarkerOf(block)?.visible, false);
  });
});
