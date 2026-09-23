// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  EDITOR_PAGES,
  editorPageFor,
  editorPageUrl,
  offlineEditorPages
} from "../src/editors/editorRegistry.ts";

describe("editorPageFor", () => {
  test("maps the registered kinds to their editor page", () => {
    assert.equal(editorPageFor("voxelmap"), "/editors/voxel-map/");
    assert.equal(editorPageFor("voxelmodel"), "/editors/voxel-model/");
    assert.equal(EDITOR_PAGES.size, 2);
  });

  test("returns undefined for a kind without an editor", () => {
    assert.equal(editorPageFor("texture"), undefined);
    assert.equal(editorPageFor("pixelart"), undefined);
  });

  test("takes another registry", () => {
    const pages = new Map([["pixelart", "/editors/pixel-art/"]]);

    assert.equal(editorPageFor("pixelart", pages), "/editors/pixel-art/");
    assert.equal(editorPageFor("voxelmap", pages), undefined);
  });
});

describe("editorPageUrl", () => {
  test("appends the encoded target to the page", () => {
    assert.equal(
      editorPageUrl("/editors/voxel-map/", "map a&b"),
      "/editors/voxel-map/?target=map+a%26b"
    );
  });

  test("keeps offline workspace parameters before the target", () => {
    const pages = offlineEditorPages("studio");
    const page = editorPageFor("voxelmodel", pages);
    assert.ok(page);
    const url = editorPageUrl(page, "model");

    assert.equal(
      url,
      "/editors/voxel-model/?offline=&workspace=studio&target=model"
    );
  });
});
