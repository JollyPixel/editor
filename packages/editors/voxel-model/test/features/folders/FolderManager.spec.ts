// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import FolderManager from "#src/features/folders/FolderManager.ts";
import type { FolderHookEvent } from "#src/features/folders/hooks.ts";

describe("FolderManager — folders", () => {
  it("adds a folder at root and emits folder-added", () => {
    const manager = new FolderManager();
    const events: FolderHookEvent[] = [];
    manager.onFolderUpdated = (event) => events.push(event);

    const uuid = manager.addFolder({ name: "Buildings" });

    assert.ok(manager.hasFolder(uuid));
    assert.deepEqual(events, [
      { action: "folder-added", uuid, name: "Buildings", parentId: null }
    ]);
  });

  it("defaults name to \"Folder\" and parentId to null", () => {
    const manager = new FolderManager();
    const uuid = manager.addFolder();

    assert.equal(manager.getFolders().get(uuid)?.name, "Folder");
    assert.equal(manager.getFolders().get(uuid)?.parentId, null);
  });

  it("renames a folder", () => {
    const manager = new FolderManager();
    const uuid = manager.addFolder({ name: "Old" });

    manager.renameFolder(uuid, "New");

    assert.equal(manager.getFolders().get(uuid)?.name, "New");
  });

  it("does nothing when renaming an unknown folder", () => {
    const manager = new FolderManager();
    const events: FolderHookEvent[] = [];
    manager.onFolderUpdated = (event) => events.push(event);

    manager.renameFolder("missing", "New");

    assert.deepEqual(events, []);
  });

  it("reparents a folder under another folder", () => {
    const manager = new FolderManager();
    const parent = manager.addFolder({ name: "Parent" });
    const child = manager.addFolder({ name: "Child" });

    manager.reparentFolder(child, parent);

    assert.equal(manager.getFolders().get(child)?.parentId, parent);
  });

  it("removes a folder and emits folder-removed", () => {
    const manager = new FolderManager();
    const uuid = manager.addFolder();
    const events: FolderHookEvent[] = [];
    manager.onFolderUpdated = (event) => events.push(event);

    manager.removeFolder(uuid);

    assert.equal(manager.hasFolder(uuid), false);
    assert.deepEqual(events, [{ action: "folder-removed", uuid }]);
  });

  it("does not emit when removing an unknown folder", () => {
    const manager = new FolderManager();
    const events: FolderHookEvent[] = [];
    manager.onFolderUpdated = (event) => events.push(event);

    manager.removeFolder("missing");

    assert.deepEqual(events, []);
  });
});

describe("FolderManager — resolveNearestNonFolderAncestor", () => {
  it("returns null unchanged", () => {
    const manager = new FolderManager();

    assert.equal(manager.resolveNearestNonFolderAncestor(null), null);
  });

  it("returns a non-folder id unchanged", () => {
    const manager = new FolderManager();

    assert.equal(manager.resolveNearestNonFolderAncestor("block-1"), "block-1");
  });

  it("resolves a root folder to null", () => {
    const manager = new FolderManager();
    const folder = manager.addFolder();

    assert.equal(manager.resolveNearestNonFolderAncestor(folder), null);
  });

  it("walks up through nested folders to the nearest block ancestor", () => {
    const manager = new FolderManager();
    const outer = manager.addFolder({ parentId: "house-block" });
    const inner = manager.addFolder({ parentId: outer });

    assert.equal(manager.resolveNearestNonFolderAncestor(inner), "house-block");
  });

  it("stays finite and returns null when a folder somehow points at itself", () => {
    const manager = new FolderManager();
    const folder = manager.addFolder();
    manager.reparentFolder(folder, folder);

    assert.equal(manager.resolveNearestNonFolderAncestor(folder), null);
  });

  it("stays finite and returns null for a longer parent cycle", () => {
    const manager = new FolderManager();
    const a = manager.addFolder({ name: "A" });
    const b = manager.addFolder({ name: "B", parentId: a });
    manager.reparentFolder(a, b);

    assert.equal(manager.resolveNearestNonFolderAncestor(b), null);
  });
});

describe("FolderManager — collectFolderSubtreeIds", () => {
  it("returns just the root id for a folder with no children", () => {
    const manager = new FolderManager();
    const folder = manager.addFolder();

    assert.deepEqual(manager.collectFolderSubtreeIds(folder), new Set([folder]));
  });

  it("includes every folder nested under the root, at any depth", () => {
    const manager = new FolderManager();
    const root = manager.addFolder({ name: "Root" });
    const child = manager.addFolder({ name: "Child", parentId: root });
    const grandchild = manager.addFolder({ name: "Grandchild", parentId: child });
    const unrelated = manager.addFolder({ name: "Unrelated" });

    const subtree = manager.collectFolderSubtreeIds(root);

    assert.deepEqual(subtree, new Set([root, child, grandchild]));
    assert.equal(subtree.has(unrelated), false);
  });

  it("stays finite when a folder somehow points at itself", () => {
    const manager = new FolderManager();
    const folder = manager.addFolder();
    manager.reparentFolder(folder, folder);

    assert.deepEqual(manager.collectFolderSubtreeIds(folder), new Set([folder]));
  });
});

describe("FolderManager — block placements", () => {
  it("places a root block into a folder and emits block-placed", () => {
    const manager = new FolderManager();
    const folder = manager.addFolder({ name: "Vegetation" });
    const events: FolderHookEvent[] = [];
    manager.onFolderUpdated = (event) => events.push(event);

    manager.placeBlock("block-1", folder);

    assert.equal(manager.getFolderOf("block-1"), folder);
    assert.deepEqual(events, [
      { action: "block-placed", blockUuid: "block-1", folderId: folder }
    ]);
  });

  it("unplaces a block when given null and emits block-unplaced", () => {
    const manager = new FolderManager();
    const folder = manager.addFolder();
    manager.placeBlock("block-1", folder);
    const events: FolderHookEvent[] = [];
    manager.onFolderUpdated = (event) => events.push(event);

    manager.placeBlock("block-1", null);

    assert.equal(manager.getFolderOf("block-1"), null);
    assert.deepEqual(events, [{ action: "block-unplaced", blockUuid: "block-1" }]);
  });

  it("does not emit block-unplaced for a block that was never placed", () => {
    const manager = new FolderManager();
    const events: FolderHookEvent[] = [];
    manager.onFolderUpdated = (event) => events.push(event);

    manager.placeBlock("block-1", null);

    assert.deepEqual(events, []);
  });

  it("moving a block between folders re-emits block-placed with the new folder", () => {
    const manager = new FolderManager();
    const folderA = manager.addFolder({ name: "A" });
    const folderB = manager.addFolder({ name: "B" });
    manager.placeBlock("block-1", folderA);

    manager.placeBlock("block-1", folderB);

    assert.equal(manager.getFolderOf("block-1"), folderB);
  });
});

describe("FolderManager — silently / applyRemoteCommand", () => {
  it("mutes emitted events while running", () => {
    const manager = new FolderManager();
    const events: FolderHookEvent[] = [];
    manager.onFolderUpdated = (event) => events.push(event);

    manager.silently(() => {
      manager.addFolder({ uuid: "f1", name: "Silent" });
    });

    assert.ok(manager.hasFolder("f1"));
    assert.deepEqual(events, []);
  });

  it("applies a remote folder-added without emitting locally", () => {
    const manager = new FolderManager();
    const events: FolderHookEvent[] = [];
    manager.onFolderUpdated = (event) => events.push(event);

    manager.applyRemoteCommand({ action: "folder-added", uuid: "f1", name: "Remote", parentId: null });

    assert.ok(manager.hasFolder("f1"));
    assert.deepEqual(events, []);
  });

  it("applies a remote block-placed", () => {
    const manager = new FolderManager();

    manager.applyRemoteCommand({ action: "block-placed", blockUuid: "block-1", folderId: "f1" });

    assert.equal(manager.getFolderOf("block-1"), "f1");
  });
});

describe("FolderManager — disposeAll", () => {
  it("clears folders and placements", () => {
    const manager = new FolderManager();
    const folder = manager.addFolder();
    manager.placeBlock("block-1", folder);

    manager.disposeAll();

    assert.equal(manager.getFolders().size, 0);
    assert.equal(manager.getPlacements().size, 0);
  });
});
