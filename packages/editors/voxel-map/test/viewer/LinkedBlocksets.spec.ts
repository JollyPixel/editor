// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  composeBlockId,
  VoxelDocument
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { LinkedBlocksets } from "../../src/viewer/LinkedBlocksets.ts";
import {
  FakeSources,
  ROCK_BLOCKSET,
  TERRAIN_BLOCKSET,
  makeCatalog,
  makeView
} from "../helpers/mapBlocksets.ts";

function setup() {
  const document = new VoxelDocument();
  document.addBlockset(TERRAIN_BLOCKSET);
  const sources = new FakeSources();
  const blocksets = new LinkedBlocksets({
    document,
    catalog: makeCatalog(),
    open: (assetId) => sources.open(assetId)
  });

  return { document, sources, blocksets };
}

describe("LinkedBlocksets", () => {
  it("projects each blockset once and loads its atlas into every attached view", () => {
    const { document, sources, blocksets } = setup();
    const first = makeView(document);
    const second = makeView(document);

    blocksets.attach(first);
    blocksets.attach(second);

    assert.deepEqual([...sources.opened.keys()], ["terrain"]);
    assert.equal(document.blocks.has(composeBlockId(1, 1)), true);
    assert.ok(first.atlases.get("terrain"));
    assert.ok(second.atlases.get("terrain"));
    assert.notEqual(first.atlases.get("terrain"), second.atlases.get("terrain"));
  });

  it("follows the blocksets the document links and unlinks", () => {
    const { document, sources, blocksets } = setup();
    const view = makeView(document);
    blocksets.attach(view);

    document.addBlockset(ROCK_BLOCKSET);

    assert.ok(view.atlases.get("rock"));
    assert.equal(document.blocks.has(composeBlockId(2, 1)), true);

    document.removeBlockset("rock");

    assert.deepEqual(sources.released, ["asset-rock"]);
    assert.equal(document.blocks.has(composeBlockId(2, 1)), false);
  });

  it("loads no later blockset into a detached view", () => {
    const { document, blocksets } = setup();
    const detached = makeView(document);
    const attached = makeView(document);
    const detach = blocksets.attach(detached);
    blocksets.attach(attached);

    detach();
    document.addBlockset(ROCK_BLOCKSET);

    assert.equal(detached.atlases.get("rock"), undefined);
    assert.ok(attached.atlases.get("rock"));
  });
});
