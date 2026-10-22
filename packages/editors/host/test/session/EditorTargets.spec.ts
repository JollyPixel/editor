// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { EditorTargets } from "#src/session/EditorTargets.ts";
import { record } from "../helpers/rooms.ts";
import {
  FakeNavigator,
  FakeSessionCatalog
} from "../helpers/session/catalog.ts";

function setup() {
  const catalog = new FakeSessionCatalog([
    {
      ...record("forest", "voxelmap"),
      path: "maps/forest.voxelmap"
    },
    record("tex", "pixelart"),
    {
      ...record("cave", "voxelmap"),
      path: "maps/cave.voxelmap"
    }
  ]);
  const navigator = new FakeNavigator();
  const targets = new EditorTargets({
    catalog,
    accepts: "voxelmap",
    current: "forest",
    navigator
  });

  return {
    catalog,
    targets,
    navigator
  };
}

describe("EditorTargets", () => {
  test("lists the catalog records of the accepted kind by path", () => {
    const { targets } = setup();

    assert.deepEqual(
      Array.from(targets, (target) => target.id),
      ["cave", "forest"]
    );
  });

  test("opening another target navigates to its current version", async() => {
    const { targets, navigator } = setup();

    await targets.open("forest");
    await targets.open("cave");

    assert.deepEqual(navigator.navigations, [
      {
        target: "cave",
        tag: null
      }
    ]);
  });

  test("announces every catalog change until disposed", () => {
    const { catalog, targets } = setup();
    let changes = 0;
    targets.on("change", () => changes++);

    catalog.emit("change");
    catalog.emit("change");
    targets.dispose();
    catalog.emit("change");

    assert.equal(changes, 2);
  });
});
