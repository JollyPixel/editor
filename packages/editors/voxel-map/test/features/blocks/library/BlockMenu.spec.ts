// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import {
  BlocksetSlot,
  MaterialGroup
} from "@jolly-pixel/voxel.renderer";
import type {
  ContextMenuEntry,
  MenuSession
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  BlockMenu,
  type BlockMenuScope,
  type BlockMenuTarget
} from "../../../../src/features/blocks/library/BlockMenu.ts";
import { MapMaterial } from "../../../../src/features/materials/MapMaterial.ts";

// CONSTANTS
const kSlot = new BlocksetSlot({ id: "terrain", slot: 1 });
const kBlockId = 7;
const kGold = material("Gold");
const kWood = material("Wood");
const kPoint = { x: 0, y: 0 };

function material(
  name: string,
  blockIds: number[] = []
): MapMaterial {
  return new MapMaterial({
    slot: kSlot,
    finish: new MaterialGroup({ id: kSlot.qualifyGroupId(name) }),
    blockIds
  });
}

function target(
  overrides: Partial<BlockMenuTarget> = {}
): BlockMenuTarget {
  return {
    blockId: kBlockId,
    materials: [kGold, kWood],
    editable: true,
    clearable: true,
    ...overrides
  };
}

function open(
  overrides: Partial<BlockMenuTarget> = {},
  scope: BlockMenuScope = "blocks"
): { session: MenuSession; ran: string[]; } {
  const ran: string[] = [];
  const session = new BlockMenu(target(overrides)).session(scope, {
    exists: () => true,
    run: (command) => {
      ran.push(command);
    },
    assign: (chosen) => {
      ran.push(`assign:${chosen.id}`);
    }
  });

  return { session, ran };
}

function choices(
  entries: readonly ContextMenuEntry[]
): string[] {
  return entries.flatMap((entry) => {
    if (entry === "separator" || entry.disabled === true) {
      return [];
    }

    return entry.items === undefined ? [entry.id] : choices(entry.items);
  });
}

describe("BlockMenu", () => {
  it("offers every action on an editable block whose voxels can be cleared", () => {
    assert.deepEqual(choices(open().session.items), [
      "edit",
      "duplicate",
      "material:terrain/Gold",
      "material:terrain/Wood",
      "new-material",
      "copy-id",
      "remove-voxels",
      "delete"
    ]);
  });

  it("only lets a block outside the editable blocksets be copied or cleared", () => {
    assert.deepEqual(
      choices(open({ editable: false }).session.items),
      ["copy-id", "remove-voxels"]
    );
    assert.equal(
      choices(open({ clearable: false }).session.items).includes("remove-voxels"),
      false
    );
  });

  it("marks the current material and offers to remove it", () => {
    const offered = choices(open({
      materials: [material("Gold", [kBlockId]), kWood]
    }).session.items);

    assert.equal(offered.includes("material:terrain/Gold"), false);
    assert.ok(offered.includes("material:terrain/Wood"));
    assert.ok(offered.includes("remove-material"));
    assert.equal(choices(open().session.items).includes("remove-material"), false);
  });

  it("keeps the Materials pane menu to materials and copying", () => {
    assert.deepEqual(choices(open({}, "materials").session.items), [
      "material:terrain/Gold",
      "material:terrain/Wood",
      "new-material",
      "copy-id"
    ]);
  });

  it("assigns a chosen material and runs only the commands it shows", async() => {
    const { session, ran } = open({ editable: false });
    const materials = open({}, "materials");

    await session.run("copy-id", kPoint);
    await session.run("delete", kPoint);
    await session.run("material:terrain/Wood", kPoint);
    await materials.session.run("material:terrain/Wood", kPoint);
    await materials.session.run("delete", kPoint);

    assert.deepEqual(ran, ["copy-id"]);
    assert.deepEqual(materials.ran, ["assign:terrain/Wood"]);
  });
});
