// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  JollyRenameDetail,
  JollyRenameEndDetail,
  TreeRenameValidator
} from "../../src/data/tree/contract.ts";
import type { TreeInteraction } from "../../src/data/tree/interaction.ts";
import { TreeRenameController } from "../../src/data/tree/TreeRenameController.ts";
import {
  TreeRowView,
  type TreeRowState
} from "../../src/data/tree/TreeRowView.ts";

// CONSTANTS
const kState: TreeRowState = {
  position: 1,
  setSize: 1,
  expanded: false,
  selected: false,
  active: false,
  drop: null,
  dropIndent: TreeRowView.indentStyle(0),
  dragSource: false,
  moveCursor: false,
  renaming: true,
  renameError: null,
  spacer: "inside",
  rails: [],
  swatchPosition: "end",
  reorderable: true,
  match: null,
  flash: false
};

type RenameEvent =
  | ["jolly-rename", JollyRenameDetail]
  | ["jolly-rename-end", JollyRenameEndDetail];

function renaming(
  validator: TreeRenameValidator | null = null
) {
  const host = new EventTarget();
  const events: RenameEvent[] = [];
  host.addEventListener("jolly-rename", (event) => {
    events.push(["jolly-rename", (event as CustomEvent<JollyRenameDetail>).detail]);
  });
  host.addEventListener("jolly-rename-end", (event) => {
    events.push(["jolly-rename-end", (event as CustomEvent<JollyRenameEndDetail>).detail]);
  });

  let interaction: TreeInteraction = {
    kind: "renaming",
    id: "hero",
    error: null
  };
  const controller = new TreeRenameController(host, {
    validateRename: () => validator,
    interaction: () => interaction,
    switchInteraction: (next) => {
      interaction = next;
    },
    focusRow: () => void 0
  });
  const view = new TreeRowView({
    node: {
      id: "hero",
      label: "Hero"
    },
    depth: 0,
    indent: 0,
    parentId: null
  }, kState);
  const field = document.createElement("input");
  field.value = view.label;
  field.addEventListener("input", (event) => controller.onInput(event as InputEvent, view));
  field.addEventListener("keydown", (event) => controller.onKeyDown(event, view));
  field.addEventListener("blur", (event) => controller.onBlur(event, view));

  return {
    events,
    type: (value: string) => {
      field.value = value;
      field.dispatchEvent(new Event("input"));
    },
    press: (key: string) => {
      field.dispatchEvent(new KeyboardEvent("keydown", { key }));
    },
    blur: () => {
      field.dispatchEvent(new Event("blur"));
    }
  };
}

describe("TreeRenameController", () => {
  test("a committed new name emits jolly-rename, then jolly-rename-end", () => {
    const rename = renaming();

    rename.type("Lens");
    rename.blur();

    assert.deepEqual(rename.events, [
      ["jolly-rename", { id: "hero", name: "Lens" }],
      ["jolly-rename-end", { id: "hero", name: "Lens" }]
    ]);
  });

  test("an unchanged commit ends the rename with the current label", () => {
    const rename = renaming();

    rename.blur();

    assert.deepEqual(rename.events, [
      ["jolly-rename-end", { id: "hero", name: "Hero" }]
    ]);
  });

  test("Escape, a blank name and a refused name end the rename without a name", () => {
    const cancelled = renaming();
    cancelled.type("Lens");
    cancelled.press("Escape");
    cancelled.blur();

    const blank = renaming();
    blank.type("  ");
    blank.blur();

    const refused = renaming(() => "Name taken");
    refused.type("Crate");
    refused.blur();

    for (const { events } of [cancelled, blank, refused]) {
      assert.deepEqual(events, [
        ["jolly-rename-end", { id: "hero", name: null }]
      ]);
    }
  });
});
