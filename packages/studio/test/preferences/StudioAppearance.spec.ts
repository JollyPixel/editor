// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { PageAppearance } from "@jolly-pixel/editor.host";
import { Preferences } from "@jolly-pixel/preferences";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  APPEARANCE_HINT_STORAGE_KEY,
  StudioAppearance
} from "../../src/preferences/StudioAppearance.ts";

function scopedPage(): Document {
  document.body.replaceChildren(document.createElement("jolly-scope"));

  return document;
}

describe("StudioAppearance", () => {
  afterEach(() => document.body.replaceChildren());

  test("paints the last applied appearance before the account loads", () => {
    const hint = new MemoryStorageAdapter();
    hint.set(APPEARANCE_HINT_STORAGE_KEY, JSON.stringify({
      theme: "dark",
      density: "compact"
    }));
    const page = new PageAppearance(scopedPage());

    new StudioAppearance({ page, hint });

    assert.deepEqual(page.toJSON(), {
      theme: "dark",
      density: "compact"
    });
  });

  test("writes changes to the account and follows its values", () => {
    const hint = new MemoryStorageAdapter();
    const page = new PageAppearance(scopedPage());
    const preferences = new Preferences({
      overrides: [["studio", { density: "comfortable" }]]
    });
    const appearance = new StudioAppearance({ page, hint });

    appearance.follow(preferences);
    appearance.theme = "light";

    assert.deepEqual(preferences.overrides("studio"), {
      density: "comfortable",
      theme: "light"
    });
    assert.deepEqual(page.toJSON(), {
      theme: "light",
      density: "comfortable"
    });
    assert.deepEqual(
      JSON.parse(hint.get(APPEARANCE_HINT_STORAGE_KEY) ?? "null"),
      { theme: "light", density: "comfortable" }
    );
  });
});
