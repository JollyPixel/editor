// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidTagNameError } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  TAGGED_ASSET_ID,
  assetTag,
  fakeTags
} from "../helpers/session/catalog.ts";

describe("EditorTags", () => {
  test("lists named tags and restore points apart, newest first", async() => {
    const { catalog, tags } = fakeTags();
    catalog.stored = [
      assetTag("v1", 2),
      assetTag("restore/5", 5),
      assetTag("v2", 7)
    ];

    await tags.load();

    assert.deepEqual(Array.from(tags, (entry) => entry.name), ["v2", "v1"]);
    assert.deepEqual(
      Array.from(tags.restorePoints(), (entry) => entry.name),
      ["restore/5"]
    );
  });

  test("follows the tag changes of its own asset only", () => {
    const { catalog, tags } = fakeTags();
    let changes = 0;
    tags.on("change", () => changes++);

    catalog.emit("tags-changed", "cave", [assetTag("v1", 2)]);
    catalog.emit("tags-changed", TAGGED_ASSET_ID, [assetTag("v3", 4)]);

    assert.equal(changes, 1);
    assert.deepEqual(Array.from(tags, (entry) => entry.name), ["v3"]);
  });

  test("creates the requested tag, leaving out an empty message", async() => {
    const { catalog, tags } = fakeTags({
      newTag: {
        name: "v1",
        message: ""
      }
    });

    await tags.create();

    assert.deepEqual(catalog.calls, [`tag ${TAGGED_ASSET_ID} v1 -`]);
  });

  test("refuses an invalid tag name before asking the server", async() => {
    const { catalog, tags } = fakeTags({
      newTag: {
        name: "restore/1",
        message: ""
      }
    });

    await assert.rejects(tags.create(), InvalidTagNameError);
    assert.deepEqual(catalog.calls, []);
  });

  test("restores only once the user confirms, warning about unsaved changes", async() => {
    const { catalog, browser, tags } = fakeTags({
      confirm: false,
      unsaved: true
    });

    assert.equal(await tags.restore("v1"), null);
    assert.deepEqual(catalog.calls, []);
    assert.match(browser.confirmed[0], /not saved yet are lost/);
  });

  test("restoring the viewed tag goes back to the current version", async() => {
    const { catalog, navigator, tags } = fakeTags({ viewing: "v1" });

    await tags.restore("v1");

    assert.deepEqual(catalog.calls, [`restore ${TAGGED_ASSET_ID} v1`]);
    assert.deepEqual(navigator.navigations, [
      {
        target: TAGGED_ASSET_ID,
        tag: null
      }
    ]);
  });

  test("deleting the viewed tag goes back to the current version", async() => {
    const { catalog, navigator, tags } = fakeTags({ viewing: "v1" });

    await tags.delete("v2");
    await tags.delete("v1");

    assert.deepEqual(catalog.calls, [
      `untag ${TAGGED_ASSET_ID} v2`,
      `untag ${TAGGED_ASSET_ID} v1`
    ]);
    assert.deepEqual(navigator.navigations, [
      {
        target: TAGGED_ASSET_ID,
        tag: null
      }
    ]);
  });

  test("viewing a tag navigates to its read-only version", async() => {
    const { navigator, tags } = fakeTags();

    await tags.view(null);
    await tags.view("restore/5");

    assert.deepEqual(navigator.navigations, [
      {
        target: TAGGED_ASSET_ID,
        tag: "restore/5"
      }
    ]);
  });
});
