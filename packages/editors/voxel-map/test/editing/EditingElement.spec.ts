// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { EditingElement } from "../../src/editing/EditingElement.ts";
import type { VoxelMapEditing } from "../../src/editing/VoxelMapEditing.ts";

describe("EditingElement", () => {
  test("attaches an editing assigned before its tag was defined", () => {
    const editing = {} as unknown as VoxelMapEditing;
    const element = document.createElement("early-editing-element");
    Object.assign(element, { editing });
    document.body.append(element);

    window.customElements.define(
      "early-editing-element",
      class extends EditingElement {}
    );

    assert.ok(element instanceof EditingElement);
    assert.equal(element.attached, editing);
    assert.equal(Object.hasOwn(element, "editing"), false);
    element.remove();
  });
});
