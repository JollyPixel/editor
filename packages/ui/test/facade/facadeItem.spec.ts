// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FacadeElement } from "../../src/facade/Element.ts";
import {
  adoptFacadeItem,
  FacadeItem,
  type FacadeOwner
} from "../../src/facade/FacadeItem.ts";

class TestItem extends FacadeItem {
  readonly element = document.createElement("div");
}

function recordingOwner(): FacadeOwner & { released: FacadeItem[]; } {
  const released: FacadeItem[] = [];

  return {
    released,
    release(child) {
      released.push(child);
    }
  };
}

describe("FacadeItem", () => {
  test("dispose removes the element from its parent", () => {
    const host = document.createElement("div");
    const item = new TestItem();
    host.append(item.element);

    item.dispose();

    assert.equal(host.children.length, 0);
  });

  test("dispose releases the item from the owner that adopted it", () => {
    const owner = recordingOwner();
    const item = new TestItem();
    adoptFacadeItem(item, owner);

    item.dispose();

    assert.deepEqual(owner.released, [item]);
  });

  test("a second dispose no longer reaches the owner", () => {
    const owner = recordingOwner();
    const item = new TestItem();
    adoptFacadeItem(item, owner);

    item.dispose();
    item.dispose();

    assert.equal(owner.released.length, 1);
  });

  test("an unowned item disposes without an owner", () => {
    const item = new TestItem();

    assert.doesNotThrow(() => item.dispose());
  });
});

describe("FacadeElement", () => {
  test("wraps the element it was given", () => {
    const element = document.createElement("span");
    const item = new FacadeElement(element);

    assert.equal(item.element, element);
  });

  test("hidden and disabled reach the wrapped element", () => {
    const item = new FacadeElement(document.createElement("span"));

    item.hidden = true;
    item.disabled = true;

    assert.equal(item.element.hidden, true);
    assert.equal(item.element.hasAttribute("disabled"), true);
  });
});
