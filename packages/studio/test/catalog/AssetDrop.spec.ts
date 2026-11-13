// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetDrop } from "../../src/catalog/AssetDrop.ts";
import {
  AssetKindSet,
  type AssetKindEntry
} from "../../src/catalog/AssetKindSet.ts";
import { DroppedFile } from "../../src/browser/DroppedFile.ts";

// CONSTANTS
const kPixelArt: AssetKindEntry = {
  kind: "pixelart",
  label: "Pixel art",
  extension: ".pixelart",
  extensions: [".pixelart"],
  convertsFrom: [".png"]
};
const kKinds = new AssetKindSet({
  kinds: [
    kPixelArt,
    {
      kind: "texture",
      label: "Texture",
      extension: ".png",
      extensions: [".png"]
    }
  ],
  editors: [
    {
      package: "@jolly-pixel/editor.pixel-art",
      kinds: ["pixelart"]
    }
  ],
  maxContentBytes: 1024
});

function names(
  files: readonly DroppedFile[]
): string[] {
  return files.map((file) => file.name);
}

describe("AssetDrop", () => {
  test("sorts files into archives, one group per convertible format, and plain files", () => {
    const drop = new AssetDrop([
      new File(["zip"], "pack.ZIP"),
      new File(["png"], "hero.png"),
      new File(["txt"], "notes.txt"),
      new File(["png"], "hero.idle.PNG")
    ].map((file) => new DroppedFile(file)), kKinds);

    assert.deepEqual(names(drop.archives), ["pack.ZIP"]);
    assert.deepEqual(names(drop.files), ["notes.txt"]);
    assert.deepEqual(drop.convertible.map((group) => {
      return {
        format: group.format,
        files: names(group.files),
        kinds: group.kinds
      };
    }), [
      {
        format: ".png",
        files: ["hero.png", "hero.idle.PNG"],
        kinds: [kPixelArt]
      }
    ]);
  });
});

describe("DroppedFile", () => {
  test("keeps everything before the last extension in its stem", () => {
    const cases = [
      ["hero.idle.PNG", "hero.idle", ".png"],
      ["README", "README", ""],
      [".gitignore", ".gitignore", ""]
    ];

    for (const [name, stem, format] of cases) {
      const file = new DroppedFile(new File([], name));

      assert.deepEqual([file.stem, file.format], [stem, format]);
    }
  });
});
