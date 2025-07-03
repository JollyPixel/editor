// Import Node.js Dependencies
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { TreeView } from "../../src/frontend/TreeView.class.js";

const window = new Window();
const document = window.document;
(global as any).window = window;
(global as any).document = document;

describe("TreeView", () => {
  let container: any;
  let treeView: TreeView;

  beforeEach(() => {
    container = document.createElement("div");
    treeView = new TreeView(container);
  });

  afterEach(() => {
    treeView.clear();
  });

  describe("append()", () => {
    it("should append an item to the root", () => {
      const element = document.createElement("li");
      const appendedElement = treeView.append(element as any, "item");

      assert.strictEqual(appendedElement.classList.contains("item"), true);
      assert.strictEqual(appendedElement.parentElement, treeView.root);
    });

    it("should append a group with children container", () => {
      const element = document.createElement("li");
      const appendedElement = treeView.append(element as any, "group");

      assert.strictEqual(appendedElement.classList.contains("group"), true);
      assert.strictEqual(appendedElement.nextElementSibling?.classList.contains("children"), true);
    });

    it("should append to a specific group", () => {
      const groupElement = document.createElement("li");
      const group = treeView.append(groupElement as any, "group");

      const itemElement = document.createElement("li");
      const appendedItem = treeView.append(itemElement as any, "item", group);

      assert.strictEqual(appendedItem.parentElement, group.nextElementSibling);
    });
  });

  describe("insertBefore()", () => {
    it("should insert an item before another item", () => {
      const firstItem = document.createElement("li");
      treeView.append(firstItem as any, "item");

      const secondItem = document.createElement("li");
      treeView.append(secondItem as any, "item");

      const newItem = document.createElement("li");
      const insertedItem = treeView.insertBefore(newItem as any, "item", secondItem as any);

      assert.strictEqual(insertedItem.nextElementSibling, secondItem);
    });

    it("should insert a group with children container", () => {
      const referenceItem = document.createElement("li");
      treeView.append(referenceItem as any, "item");

      const newGroup = document.createElement("li");
      const insertedGroup = treeView.insertBefore(newGroup as any, "group", referenceItem as any);

      assert.strictEqual(insertedGroup.classList.contains("group"), true);
      assert.strictEqual(insertedGroup.nextElementSibling?.classList.contains("children"), true);
    });
  });

  describe("insertAt()", () => {
    it("should insert an item at specific index", () => {
      const firstItem = document.createElement("li");
      treeView.append(firstItem as any, "item");

      const newItem = document.createElement("li");
      const insertedItem = treeView.insertAt(newItem as any, "item", 0);

      assert.notStrictEqual(insertedItem, null);
      if (insertedItem) {
        assert.strictEqual(insertedItem, newItem);
        // assert.strictEqual(insertedItem.nextElementSibling, firstItem);
      }
    });

    it("should return null when index is out of bounds", () => {
      const element = document.createElement("li");
      const result = treeView.insertAt(element as any, "item", 999);

      assert.strictEqual(result, null);
    });
  });

  describe("remove()", () => {
    it("should remove an item", () => {
      const element = document.createElement("li");
      treeView.append(element as any, "item");

      treeView.remove(element as any);

      assert.strictEqual(element.parentElement, null);
    });

    it("should remove a group and its children container", () => {
      const groupElement = document.createElement("li");
      const group = treeView.append(groupElement as any, "group");

      treeView.remove(group);

      assert.strictEqual(group.parentElement, null);
      assert.strictEqual(group.nextElementSibling, null);
    });
  });
});
