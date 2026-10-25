// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  AssetChoices,
  type AssetChoiceNode
} from "#src/session/picker/AssetChoices.ts";
import { FakeSessionCatalog } from "../helpers/session/catalog.ts";

// CONSTANTS
const kVoxelMap: AssetKindDescriptor = {
  kind: "voxelmap",
  label: "Voxel map",
  extension: ".voxelmap.json"
};
const kForest: AssetReferenceData = {
  id: "forest",
  kind: "voxelmap"
};

type Outline = string | { [folder: string]: Outline[]; };

function outline(
  node: AssetChoiceNode
): Outline {
  return node.children === undefined ?
    node.label :
    { [node.label]: node.children.map(outline) };
}

function setup(
  current: AssetReferenceData | null = null
) {
  const catalog = new FakeSessionCatalog([
    {
      id: "forest",
      kind: "voxelmap",
      path: "maps/forest.voxelmap.json"
    },
    {
      id: "deep",
      kind: "voxelmap",
      path: "maps/caves/deep.voxelmap.json"
    },
    {
      id: "map10",
      kind: "voxelmap",
      path: "map10.voxelmap.json"
    },
    {
      id: "map2",
      kind: "voxelmap",
      path: "map2.voxelmap.json"
    },
    {
      id: "stone",
      kind: "blockset",
      path: "blocks/stone.blockset.json"
    },
    {
      id: "tex",
      kind: "pixelart",
      path: "tex.pixelart.json"
    }
  ]);
  const choices = new AssetChoices({
    catalog,
    kinds: [kVoxelMap],
    current
  });

  return {
    catalog,
    choices
  };
}

describe("AssetChoices", () => {
  test("lists only the requested kinds, folders first, and drops folders without one", () => {
    const { choices } = setup();

    assert.deepEqual(choices.nodes.map(outline), [
      {
        maps: [
          { caves: ["deep"] },
          "forest"
        ]
      },
      "map2",
      "map10"
    ]);
    assert.deepEqual(choices.expanded, ["folder:maps/", "folder:maps/caves/"]);
  });

  test("preselects the current asset and chooses only an asset row", () => {
    const { choices } = setup(kForest);

    assert.deepEqual(choices.selected, ["asset:forest"]);
    assert.deepEqual(choices.chosen, kForest);

    choices.select(["folder:maps/"]);
    assert.deepEqual(choices.selected, ["folder:maps/"]);
    assert.equal(choices.chosen, null);
  });

  test("ignores a current asset that is no longer in the catalog", () => {
    const { choices } = setup({
      id: "gone",
      kind: "voxelmap"
    });

    assert.deepEqual(choices.selected, []);
    assert.equal(choices.chosen, null);
  });

  test("follows catalog changes and drops the selection of a removed asset", async() => {
    const { catalog, choices } = setup(kForest);
    let changes = 0;
    choices.on("change", () => {
      changes++;
    });

    await catalog.remove("forest");
    assert.equal(choices.chosen, null);
    assert.deepEqual(choices.nodes.map(outline), [
      { maps: [{ caves: ["deep"] }] },
      "map2",
      "map10"
    ]);

    catalog.assets.push({
      id: "lake",
      kind: "voxelmap",
      path: "lake.voxelmap.json"
    });
    catalog.emit("change");
    assert.ok(choices.nodes.some((node) => node.label === "lake"));
    assert.equal(changes, 2);

    choices.dispose();
    catalog.emit("change");
    assert.equal(changes, 2);
  });

  test("activating a folder toggles it and activating an asset chooses it", () => {
    const { choices } = setup();

    assert.equal(choices.activate("folder:maps/"), null);
    assert.deepEqual(choices.expanded, ["folder:maps/caves/"]);

    assert.deepEqual(choices.activate("asset:forest"), kForest);
    assert.deepEqual(choices.chosen, kForest);
  });
});
