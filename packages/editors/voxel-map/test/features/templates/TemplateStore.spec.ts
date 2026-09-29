// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { TemplateStore } from "../../../src/features/templates/TemplateStore.ts";

describe("TemplateStore", () => {
  test("emits once per selection change", () => {
    const store = new TemplateStore();
    const changes: Array<string | null> = [];
    store.subscribe("selectionChange", (templateId) => changes.push(templateId));

    store.selected = "house";
    store.selected = "house";
    store.selected = null;

    assert.deepEqual(changes, ["house", null]);
  });

  test("reconcile drops the selection of a removed template only", () => {
    const store = new TemplateStore();
    store.selected = "house";

    store.reconcile(["house", "tree"]);
    assert.equal(store.selected, "house");

    store.reconcile(["tree"]);
    assert.equal(store.selected, null);
  });
});
