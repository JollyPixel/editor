// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { FolderCommand } from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import { ModelFolders } from "#src/model/index.ts";

describe("ModelFolders — folders", () => {
  it("adds a folder at root and emits folder-added", () => {
    const manager = new ModelFolders();
    const events: FolderCommand[] = [];
    manager.on("command", (event) => events.push(event));

    const uuid = manager.add({ name: "Buildings" });

    assert.ok(manager.has(uuid));
    assert.deepEqual(events, [
      { action: "folder-added", uuid, name: "Buildings", parentId: null }
    ]);
  });

  it("defaults name to \"Folder\" and parentId to null", () => {
    const manager = new ModelFolders();
    const uuid = manager.add();

    assert.equal(manager.folders.get(uuid)?.name, "Folder");
    assert.equal(manager.folders.get(uuid)?.parentId, null);
  });

  it("renames a folder", () => {
    const manager = new ModelFolders();
    const uuid = manager.add({ name: "Old" });

    manager.rename(uuid, "New");

    assert.equal(manager.folders.get(uuid)?.name, "New");
  });

  it("does nothing when renaming an unknown folder", () => {
    const manager = new ModelFolders();
    const events: FolderCommand[] = [];
    manager.on("command", (event) => events.push(event));

    manager.rename("missing", "New");

    assert.deepEqual(events, []);
  });

  it("reparents a folder under another folder", () => {
    const manager = new ModelFolders();
    const parent = manager.add({ name: "Parent" });
    const child = manager.add({ name: "Child" });

    manager.reparent(child, parent);

    assert.equal(manager.folders.get(child)?.parentId, parent);
  });

  it("removes a folder and emits folder-removed", () => {
    const manager = new ModelFolders();
    const uuid = manager.add();
    const events: FolderCommand[] = [];
    manager.on("command", (event) => events.push(event));

    manager.remove(uuid);

    assert.equal(manager.has(uuid), false);
    assert.deepEqual(events, [{ action: "folder-removed", uuid }]);
  });

  it("does not emit when removing an unknown folder", () => {
    const manager = new ModelFolders();
    const events: FolderCommand[] = [];
    manager.on("command", (event) => events.push(event));

    manager.remove("missing");

    assert.deepEqual(events, []);
  });
});

describe("ModelFolders — nearestBlockAncestor", () => {
  it("returns null unchanged", () => {
    const manager = new ModelFolders();

    assert.equal(manager.nearestBlockAncestor(null), null);
  });

  it("returns a non-folder id unchanged", () => {
    const manager = new ModelFolders();

    assert.equal(manager.nearestBlockAncestor("block-1"), "block-1");
  });

  it("resolves a root folder to null", () => {
    const manager = new ModelFolders();
    const folder = manager.add();

    assert.equal(manager.nearestBlockAncestor(folder), null);
  });

  it("walks up through nested folders to the nearest block ancestor", () => {
    const manager = new ModelFolders();
    const outer = manager.add({ parentId: "house-block" });
    const inner = manager.add({ parentId: outer });

    assert.equal(manager.nearestBlockAncestor(inner), "house-block");
  });

  it("stays finite and returns null when a folder somehow points at itself", () => {
    const manager = new ModelFolders();
    const folder = manager.add();
    manager.reparent(folder, folder);

    assert.equal(manager.nearestBlockAncestor(folder), null);
  });

  it("stays finite and returns null for a longer parent cycle", () => {
    const manager = new ModelFolders();
    const a = manager.add({ name: "A" });
    const b = manager.add({ name: "B", parentId: a });
    manager.reparent(a, b);

    assert.equal(manager.nearestBlockAncestor(b), null);
  });
});

describe("ModelFolders — subtreeOf", () => {
  it("returns just the root id for a folder with no children", () => {
    const manager = new ModelFolders();
    const folder = manager.add();

    assert.deepEqual(manager.subtreeOf(folder), new Set([folder]));
  });

  it("includes every folder nested under the root, at any depth", () => {
    const manager = new ModelFolders();
    const root = manager.add({ name: "Root" });
    const child = manager.add({ name: "Child", parentId: root });
    const grandchild = manager.add({ name: "Grandchild", parentId: child });
    const unrelated = manager.add({ name: "Unrelated" });

    const subtree = manager.subtreeOf(root);

    assert.deepEqual(subtree, new Set([root, child, grandchild]));
    assert.equal(subtree.has(unrelated), false);
  });

  it("stays finite when a folder somehow points at itself", () => {
    const manager = new ModelFolders();
    const folder = manager.add();
    manager.reparent(folder, folder);

    assert.deepEqual(manager.subtreeOf(folder), new Set([folder]));
  });
});

describe("ModelFolders — block placements", () => {
  it("places a root block into a folder and emits block-placed", () => {
    const manager = new ModelFolders();
    const folder = manager.add({ name: "Vegetation" });
    const events: FolderCommand[] = [];
    manager.on("command", (event) => events.push(event));

    manager.place("block-1", folder);

    assert.equal((manager.placements.get("block-1") ?? null), folder);
    assert.deepEqual(events, [
      { action: "block-placed", blockUuid: "block-1", folderId: folder }
    ]);
  });

  it("unplaces a block when given null and emits block-unplaced", () => {
    const manager = new ModelFolders();
    const folder = manager.add();
    manager.place("block-1", folder);
    const events: FolderCommand[] = [];
    manager.on("command", (event) => events.push(event));

    manager.place("block-1", null);

    assert.equal((manager.placements.get("block-1") ?? null), null);
    assert.deepEqual(events, [{ action: "block-unplaced", blockUuid: "block-1" }]);
  });

  it("does not emit block-unplaced for a block that was never placed", () => {
    const manager = new ModelFolders();
    const events: FolderCommand[] = [];
    manager.on("command", (event) => events.push(event));

    manager.place("block-1", null);

    assert.deepEqual(events, []);
  });

  it("moving a block between folders re-emits block-placed with the new folder", () => {
    const manager = new ModelFolders();
    const folderA = manager.add({ name: "A" });
    const folderB = manager.add({ name: "B" });
    manager.place("block-1", folderA);

    manager.place("block-1", folderB);

    assert.equal((manager.placements.get("block-1") ?? null), folderB);
  });
});

describe("ModelFolders — apply", () => {
  it("applies a remote folder-added without emitting locally", () => {
    const manager = new ModelFolders();
    const events: FolderCommand[] = [];
    manager.on("command", (event) => events.push(event));

    manager.apply({ action: "folder-added", uuid: "f1", name: "Remote", parentId: null });

    assert.ok(manager.has("f1"));
    assert.deepEqual(events, []);
  });

  it("applies a remote block-placed and block-unplaced", () => {
    const manager = new ModelFolders();

    manager.apply({ action: "block-placed", blockUuid: "block-1", folderId: "f1" });
    assert.equal(manager.placements.get("block-1"), "f1");

    manager.apply({ action: "block-unplaced", blockUuid: "block-1" });
    assert.equal(manager.placements.has("block-1"), false);
  });

  it("emits again once a remote command is applied", () => {
    const manager = new ModelFolders();
    const events: FolderCommand[] = [];
    manager.on("command", (event) => events.push(event));

    manager.apply({ action: "folder-added", uuid: "f1", name: "Remote", parentId: null });
    manager.rename("f1", "Local");

    assert.deepEqual(events, [{ action: "folder-renamed", uuid: "f1", name: "Local" }]);
  });
});

describe("ModelFolders — load", () => {
  it("replaces folders and placements without emitting", () => {
    const manager = new ModelFolders();
    const events: FolderCommand[] = [];
    const stale = manager.add();
    manager.place("block-1", stale);
    manager.on("command", (event) => events.push(event));

    manager.load(
      [{ uuid: "f2", name: "Loaded", parentId: null }],
      [{ blockUuid: "block-2", folderId: "f2" }]
    );

    assert.deepEqual([...manager.folders.keys()], ["f2"]);
    assert.deepEqual([...manager.placements], [["block-2", "f2"]]);
    assert.deepEqual(events, []);
  });
});
