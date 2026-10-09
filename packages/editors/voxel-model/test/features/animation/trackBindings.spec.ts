// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TrackBindingsController } from "#src/features/animation/tracks/TrackBindingsController.ts";
import { MenuSession } from "#src/shared/menu/MenuSession.ts";
import {
  createAnimatedModel,
  createHost
} from "./fixtures.ts";

function setup() {
  const model = createAnimatedModel();
  let menu = MenuSession.EMPTY;
  const bindings = new TrackBindingsController(createHost(), {
    openMenu: (session) => {
      menu = session;
    }
  });
  bindings.attach(model);

  async function pick(
    label: string
  ): Promise<void> {
    const item = menu.items.find((entry) => entry !== "separator" && entry.label === label);
    assert.ok(item !== undefined && item !== "separator", `no "${label}" in the menu`);
    await menu.run(item.id, { x: 0, y: 0 });
  }

  function rows() {
    return bindings.state?.rows.map(({ path, state, target }) => [path, state, target]);
  }

  return { model, bindings, pick, rows };
}

describe("TrackBindingsController", () => {
  test("lists a track whose block was renamed, and rebinds it to a block as one undo step", async() => {
    const { model, bindings, pick, rows } = setup();
    assert.deepEqual(rows(), [], "every track binds by name");

    model.document.rename(model.ids.arm, "Hand");
    assert.deepEqual(rows(), [["Body/Arm", "missing", null]]);

    bindings.rebind("Body/Arm", { x: 0, y: 0 });
    await pick("Body/Hand");
    assert.deepEqual(rows(), [["Body/Arm", "remapped", "Body/Hand"]]);
    assert.equal(model.history.state(model.setScope).undoLabel, "Rebind Body/Arm");
    assert.equal(model.history.state(model.clipScope).undoCount, 0);

    model.history.undo(model.setScope);
    assert.deepEqual(rows(), [["Body/Arm", "missing", null]]);
  });

  test("ignores a track on this model, and resets it to bind by its own path", () => {
    const { bindings, rows } = setup();

    bindings.ignore("Body/Arm");
    assert.deepEqual(rows(), [["Body/Arm", "ignored", null]]);

    bindings.reset("Body/Arm");
    assert.deepEqual(rows(), []);
  });
});
