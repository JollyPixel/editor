// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ContextMenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  createMaterialHarness as createHarness,
  dropMaterials as drop,
  listMaterialNames as namesOf,
  type MaterialHarness
} from "../materialHarness.ts";
import { usageRowId } from "#src/features/material/library/usageRows.ts";

// CONSTANTS
const kMenuPoint = {
  x: 12,
  y: 34
};

async function choose(
  harness: MaterialHarness,
  id: string | null,
  action: string
): Promise<void> {
  await harness.controller.openMenu(id).run(action, kMenuPoint);
}

function listLabels(
  entries: readonly ContextMenuEntry[]
): string[] {
  return entries.map((entry) => (entry === "separator" ? "-" : entry.label));
}

describe("MaterialLibraryController block rows", () => {
  test("lists the blocks using a material under it, in hierarchy order, with their peers", () => {
    const harness = createHarness();
    const arm = harness.addBlock({ name: "Arm", materialId: harness.glass });
    harness.addBlock({ name: "Bare" });
    const leg = harness.addBlock({ name: "Leg", materialId: harness.glass });
    harness.presence.blockSelections = new Map([
      [leg.uuid, [{ clientId: "bob", displayName: "Bob", color: "#ff0000" }]]
    ]);

    const [glass] = harness.controller.state.nodes;

    assert.equal(glass.detail, "2");
    assert.deepEqual(glass.children, [
      {
        id: usageRowId(arm.uuid),
        label: "Arm",
        renamable: false
      },
      {
        id: usageRowId(leg.uuid),
        label: "Leg",
        renamable: false,
        badges: [{ color: "#ff0000", title: "Bob" }]
      }
    ]);
  });

  test("selects the block of a clicked row, and the row of a block selected elsewhere", () => {
    const harness = createHarness();
    const metal = harness.document.addMaterial({ name: "Metal" })!;
    const arm = harness.addBlock({ name: "Arm", materialId: harness.glass });
    const leg = harness.addBlock({ name: "Leg", materialId: metal });

    harness.controller.handleSelect(new CustomEvent("jolly-select", {
      detail: { selected: [usageRowId(arm.uuid)] }
    }));

    assert.equal(harness.selection.selected, arm.uuid);
    assert.equal(harness.controller.state.selectedId, usageRowId(arm.uuid));
    assert.equal(harness.controller.state.editedId, harness.glass);

    harness.selection.select(leg.uuid);

    assert.equal(harness.controller.state.selectedId, usageRowId(leg.uuid));
    assert.equal(harness.controller.state.editedId, metal);
    assert.ok(harness.controller.state.expanded.includes(metal));
  });

  test("highlights the selected block's row whenever its material is edited", () => {
    const harness = createHarness();
    const metal = harness.document.addMaterial({ name: "Metal" })!;
    const arm = harness.addBlock({ name: "Arm", materialId: harness.glass });
    harness.selection.select(arm.uuid);

    harness.controller.select(metal);
    assert.equal(harness.controller.state.selectedId, metal);

    harness.controller.select(harness.glass);
    assert.equal(harness.controller.state.selectedId, usageRowId(arm.uuid));
  });

  test("keeps editing a material taken off the selected block", () => {
    const harness = createHarness();
    const arm = harness.addBlock({ name: "Arm", materialId: harness.glass });
    harness.selection.select(arm.uuid);

    harness.controller.assign(null);

    assert.equal(harness.controller.state.selectedId, harness.glass);
    assert.equal(harness.controller.state.editedId, harness.glass);
  });

  test("refuses to drag a block row or drop next to one", () => {
    const harness = createHarness();
    const arm = harness.addBlock({ materialId: harness.glass });
    const metal = harness.document.addMaterial({ name: "Metal" })!;
    const row = usageRowId(arm.uuid);

    assert.equal(
      harness.controller.acceptDrop({ movedIds: [row], targetId: metal, where: "above" }),
      false
    );
    assert.equal(
      harness.controller.acceptDrop({ movedIds: [metal], targetId: row, where: "below" }),
      false
    );
  });

  test("opens a material on activation instead of applying it", () => {
    const harness = createHarness();
    harness.addBlock({ materialId: harness.glass });
    const bare = harness.addBlock();
    harness.selection.select(bare.uuid);
    harness.actions.length = 0;

    harness.controller.handleActivate(new CustomEvent("jolly-activate", {
      detail: { id: harness.glass }
    }));

    assert.ok(harness.controller.state.expanded.includes(harness.glass));
    assert.deepEqual(harness.actions, []);
  });
});

describe("MaterialLibraryController order", () => {
  test("lists materials an asset keeps in folders in one flat list", () => {
    const harness = createHarness();
    const metals = harness.document.addMaterialFolder({ name: "Metals" })!;
    const steel = harness.document.addMaterial({ name: "Steel", parentId: metals })!;
    const bolt = harness.addBlock({ materialId: steel });

    harness.selection.select(bolt.uuid);

    assert.deepEqual(
      harness.controller.state.nodes.map(({ id }) => id),
      [harness.glass, steel]
    );
    assert.deepEqual(harness.controller.state.expanded, [steel]);
    assert.equal(harness.controller.state.editedId, steel);
  });

  test("reorders a dropped material among the others and refuses drops inside a row", () => {
    const harness = createHarness();
    const metal = harness.document.addMaterial({ name: "Metal" })!;

    drop(harness, [metal], harness.glass, "above");

    assert.deepEqual(namesOf(harness), ["Metal", "Glass"]);
    assert.equal(
      harness.controller.acceptDrop({ movedIds: [harness.glass], targetId: metal, where: "inside" }),
      false
    );
    assert.equal(
      harness.controller.acceptDrop({ movedIds: [harness.glass], targetId: metal, where: "above" }),
      true
    );
  });

  test("moves a material next to one an asset keeps in a folder", () => {
    const harness = createHarness();
    const metals = harness.document.addMaterialFolder({ name: "Metals" })!;
    const steel = harness.document.addMaterial({ name: "Steel", parentId: metals })!;

    drop(harness, [harness.glass], steel, "below");

    assert.equal(harness.document.tree.materials.get(harness.glass)?.parentId, metals);
  });
});

describe("MaterialLibraryController.openMenu", () => {
  test("lists the actions of the tree and of a material", () => {
    const harness = createHarness();

    assert.deepEqual(listLabels(harness.controller.openMenu(null).items), [
      "New Material…",
      "-",
      "Paste"
    ]);
    assert.deepEqual(listLabels(harness.controller.openMenu(harness.glass).items), [
      "Rename",
      "Duplicate",
      "Copy",
      "-",
      "Delete"
    ]);
  });

  test("offers no actions on a block listed under its material", () => {
    const harness = createHarness();
    const block = harness.addBlock({ name: "Arm", materialId: harness.glass });
    harness.selection.select(block.uuid);

    assert.deepEqual(harness.controller.openMenu(harness.controller.state.selectedId).items, []);
    assert.equal(listLabels(harness.controller.openMenu(harness.glass).items)[0], "Rename");
  });

  test("adds the preset offered where the menu was opened", async() => {
    const harness = createHarness();

    await choose(harness, null, "new-material");

    assert.deepEqual(namesOf(harness), ["Glass", "Metal"]);
    assert.deepEqual(harness.calls.presetPoints, [kMenuPoint]);
  });

  test("copies through the clipboard and pastes from it", async() => {
    const harness = createHarness({ clipboard: null });

    await choose(harness, harness.glass, "copy");
    await choose(harness, null, "paste");

    assert.equal(harness.calls.written.length, 1);
    assert.deepEqual(namesOf(harness), ["Glass"]);
  });

  test("runs nothing for a row removed since its menu opened, or an action it did not list", async() => {
    const harness = createHarness();
    const menu = harness.controller.openMenu(harness.glass);

    await choose(harness, null, "delete");
    harness.document.removeMaterial(harness.glass);
    await menu.run("duplicate", kMenuPoint);

    assert.deepEqual(namesOf(harness), []);
  });
});
