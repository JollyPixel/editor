// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type { MenuSession } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  MaterialMenu,
  type MaterialMenuTarget
} from "../../../src/features/materials/MaterialMenu.ts";
import { choices } from "../../helpers/menus.ts";

// CONSTANTS
const kPoint = { x: 0, y: 0 };

function open(
  overrides: Partial<MaterialMenuTarget> = {},
  exists = true
): { session: MenuSession; ran: string[]; } {
  const ran: string[] = [];
  const session = new MaterialMenu({
    editable: true,
    pristine: false,
    blockUse: "apply",
    ...overrides
  }).session({
    exists: () => exists,
    run: (command) => {
      ran.push(command);
    }
  });

  return { session, ran };
}

describe("MaterialMenu", () => {
  it("offers applying, editing and deleting an editable material", () => {
    assert.deepEqual(choices(open().session.items), [
      "apply",
      "rename",
      "duplicate",
      "reset",
      "delete"
    ]);
  });

  it("follows the selected block: remove when it uses the material, nothing when blocked", () => {
    assert.deepEqual(
      choices(open({ blockUse: "unapply" }).session.items).slice(0, 1),
      ["unapply"]
    );
    assert.equal(
      choices(open({ blockUse: "blocked" }).session.items).includes("apply"),
      false
    );
  });

  it("only applies a material of a read-only blockset", () => {
    assert.deepEqual(choices(open({ editable: false }).session.items), ["apply"]);
  });

  it("offers no reset for a material already at the default finish", () => {
    assert.equal(
      choices(open({ pristine: true }).session.items).includes("reset"),
      false
    );
  });

  it("runs only the commands it shows, while the material exists", async() => {
    const readOnly = open({ editable: false });
    const gone = open({}, false);

    await readOnly.session.run("delete", kPoint);
    await readOnly.session.run("apply", kPoint);
    await gone.session.run("rename", kPoint);

    assert.deepEqual(readOnly.ran, ["apply"]);
    assert.deepEqual(gone.ran, []);
  });
});
