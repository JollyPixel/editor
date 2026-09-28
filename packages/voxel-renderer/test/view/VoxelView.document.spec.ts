// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  chunkMeshes,
  createView,
  faceCountOf,
  makeView,
  placeCube
} from "../helpers/view.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { mockTexture } from "../helpers/mockTexture.ts";
import { MISSING_TILESET_ID } from "../../src/document/tilesets/index.ts";

describe("VoxelView - construction", () => {
  it("creates the layers passed via options and no mesh until a tick", () => {
    const view = createView({ layers: ["Ground"] });

    assert.ok(view.document.world.getLayer("Ground"));
    assert.equal(chunkMeshes(view).length, 0);
  });
});

describe("VoxelView - tilesets", () => {
  it("declares the tilesets of a loaded document", () => {
    const view = makeView();
    const data = view.document.save();
    data.tilesets = [
      { id: "atlas", src: "/atlas.png", tileSize: 16 },
      { id: "later", src: "later-asset", tileSize: 32 }
    ];

    view.load(data);

    assert.deepEqual(view.document.tilesets.definitions().map((def) => def.id), ["atlas", "later"]);
    assert.ok(view.atlases.get("atlas"));
    assert.equal(view.atlases.get("later"), undefined);
  });

  it("drops the atlas of a tileset missing from a loaded document", () => {
    const view = makeView();
    const data = view.document.save();
    data.tilesets = [];

    view.load(data);

    assert.equal(view.atlases.get("atlas"), undefined);
  });

  it("rebuilds the atlas of a tileset loaded again with another tile size", () => {
    const view = makeView();
    const slot = view.document.tilesets.get("atlas")?.slot;

    view.loadTileset({ id: "atlas", src: "/atlas.png", tileSize: 32 }, mockTexture());

    assert.equal(view.document.tilesets.get("atlas")?.slot, slot);
    assert.equal(view.document.tilesets.get("atlas")?.tileSize, 32);
    assert.equal(view.atlases.atlas("atlas").def.tileSize, 32);
  });

  it("redraws the blocks of a removed tileset with the missing texture", () => {
    const view = makeView({ layers: ["Ground"] });
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    view.flush();
    assert.equal(chunkMeshes(view).length, 1);

    assert.equal(view.document.removeTileset("atlas"), true);
    view.flush();

    assert.equal(view.atlases.get("atlas"), undefined);
    const meshes = chunkMeshes(view);
    assert.equal(meshes.length, 1);
    assert.ok(meshes[0].name.includes(MISSING_TILESET_ID));
    assert.equal(faceCountOf(meshes[0]), 6);
  });

  it("keeps culling against a block drawn with the missing texture", () => {
    const view = makeView({ layers: ["Ground"] });
    view.loadTileset({ id: "b", src: "b", tileSize: 16 }, mockTexture());
    view.document.defineBlock(makeBlockDef(7, "cube", {
      defaultTexture: { col: 0, row: 0, tilesetId: "b" }
    }));
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    placeCube(view, "Ground", { x: 1, y: 0, z: 0 }, 7);

    view.document.removeTileset("b");
    view.flush();

    assert.deepEqual(
      chunkMeshes(view)
        .map(faceCountOf)
        .sort(),
      [5, 5]
    );
  });

  it("stops culling against a block whose tileset has no texture yet", () => {
    const view = makeView({ layers: ["Ground"] });
    view.document.addTileset({ id: "later", src: "later", tileSize: 16 });
    view.document.defineBlock(makeBlockDef(7, "cube", {
      defaultTexture: { col: 0, row: 0, tilesetId: "later" }
    }));
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    placeCube(view, "Ground", { x: 1, y: 0, z: 0 }, 7);

    view.flush();

    const meshes = chunkMeshes(view);
    assert.equal(meshes.length, 1);
    assert.equal(faceCountOf(meshes[0]), 6);
  });
});
