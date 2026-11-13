// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AssetKindSet,
  newAssetName,
  type AssetKindEntry
} from "../../src/catalog/AssetKindSet.ts";

// CONSTANTS
const kMap: AssetKindEntry = {
  kind: "voxelmap",
  label: "Voxel map",
  extension: ".voxelmap.json",
  extensions: [".voxelmap.json"],
  icon: "kind:voxelmap"
};
const kTexture: AssetKindEntry = {
  kind: "texture",
  label: "Texture",
  extension: ".png",
  extensions: [".png"]
};
const kKinds = new AssetKindSet({
  kinds: [kMap, kTexture],
  editors: [
    {
      package: "@jolly-pixel/editor.voxel-map",
      kinds: ["voxelmap"]
    }
  ],
  maxContentBytes: 1024
});

describe("AssetKindSet", () => {
  test("rows the kinds by the editor that opens them, then the kinds no editor opens", () => {
    const kinds = new AssetKindSet({
      kinds: [kTexture, kMap],
      editors: [
        {
          package: "@jolly-pixel/editor.voxel-map",
          kinds: ["voxelmap", "blockset"]
        }
      ],
      maxContentBytes: 1024
    });

    assert.deepEqual(kinds.byEditor(), [
      {
        package: "@jolly-pixel/editor.voxel-map",
        kinds: [kMap]
      },
      {
        package: null,
        kinds: [kTexture]
      }
    ]);
    assert.deepEqual(AssetKindSet.EMPTY.byEditor(), []);
  });

  test("knows only the listed kinds", () => {
    assert.equal(kKinds.has("voxelmap"), true);
    assert.equal(kKinds.has("binary"), false);
    assert.equal(AssetKindSet.EMPTY.has("voxelmap"), false);
  });

  test("finds the entry of a listed kind", () => {
    assert.deepEqual(kKinds.findEntry("voxelmap"), kMap);
    assert.equal(kKinds.findEntry("binary"), undefined);
  });

  test("names a new asset after the kind label", () => {
    assert.equal(newAssetName(kMap), "New voxel map");
    assert.equal(newAssetName(kTexture), "New texture");
  });

  test("falls back to the file icon", () => {
    assert.equal(kKinds.kindIcon("voxelmap"), "kind:voxelmap");
    assert.equal(kKinds.kindIcon("texture"), "file");
    assert.equal(kKinds.kindIcon("binary"), "file");
  });

  test("limits content by the kind its name resolves to, else by the catalog's limit", () => {
    const kinds = new AssetKindSet({
      kinds: [
        {
          kind: "text",
          label: "Text",
          extension: ".md",
          extensions: [".md", ".json"],
          maxContentBytes: 8
        },
        {
          kind: "model",
          label: "Model",
          extension: ".glb",
          extensions: [".glb", ".fbx"],
          maxContentBytes: 64
        },
        kTexture,
        {
          ...kMap,
          maxContentBytes: 4
        }
      ],
      editors: [],
      maxContentBytes: 16
    });
    const cases: Array<[string, number]> = [
      ["hero.fbx", 64],
      ["hero.FBX", 16],
      ["world.voxelmap.json", 4],
      ["tiles.png", 16],
      ["notes.json", 8],
      ["notes.txt", 16]
    ];

    for (const [name, limit] of cases) {
      assert.strictEqual(kinds.contentLimit(kinds.resolve(name)), limit, name);
    }
  });

  test("details every kind no editor opens, listed or not", () => {
    assert.equal(kKinds.kindDetail("voxelmap"), undefined);
    assert.equal(kKinds.kindDetail("texture"), "no editor");
    assert.equal(kKinds.kindDetail("binary"), "no editor");
  });

  test("displays a name without the extension of its kind", () => {
    assert.equal(
      kKinds.trimExtension("voxelmap", "cave.voxelmap.json"),
      "cave"
    );
    assert.equal(
      kKinds.trimExtension("voxelmap", "v1.2 cave.voxelmap.json"),
      "v1.2 cave"
    );
    assert.equal(kKinds.trimExtension("texture", "grass.png"), "grass");
  });

  test("displays the whole name when the kind extension does not apply", () => {
    assert.equal(kKinds.trimExtension("binary", "data.bin"), "data.bin");
    assert.equal(kKinds.trimExtension("voxelmap", "cave.json"), "cave.json");
    assert.equal(
      kKinds.trimExtension("voxelmap", ".voxelmap.json"),
      ".voxelmap.json"
    );
  });

  test("offers the listed kinds in order", () => {
    assert.deepEqual(kKinds.toOptions(), [
      {
        value: "voxelmap",
        label: "Voxel map",
        icon: "kind:voxelmap"
      },
      {
        value: "texture",
        label: "Texture",
        icon: "file"
      }
    ]);
    assert.deepEqual(AssetKindSet.EMPTY.toOptions(), []);
  });

  test("copies and freezes its inputs", () => {
    const kinds: AssetKindEntry[] = [{ ...kTexture }];
    const editorKinds = ["texture"];
    const set = new AssetKindSet({
      kinds,
      editors: [
        {
          package: "@jolly-pixel/editor.texture",
          kinds: editorKinds
        }
      ],
      maxContentBytes: 1024
    });
    kinds.push(kMap);
    editorKinds.push("voxelmap");

    assert.equal(set.has("voxelmap"), false);
    assert.equal(set.kindDetail("voxelmap"), "no editor");
    assert.equal(Object.isFrozen(set.entries), true);
    assert.equal(Object.isFrozen(set.entries[0]), true);
  });
});
