// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { TemplatePreviewStore } from "../../src/state/TemplatePreviewStore.ts";

describe("TemplatePreviewStore", () => {
  test("previews templates by default", () => {
    assert.equal(new TemplatePreviewStore().value, "enabled");
  });

  test("restores a disabled preview from the previous session", () => {
    const storage = new MemoryStorageAdapter();
    new TemplatePreviewStore(storage).value = "disabled";

    assert.equal(storage.get("voxel-map:template-preview"), "disabled");
    assert.equal(new TemplatePreviewStore(storage).value, "disabled");
  });
});
