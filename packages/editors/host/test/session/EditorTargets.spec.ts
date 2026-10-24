// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PromptOptions } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { EditorTargets } from "#src/session/EditorTargets.ts";
import { LastTargetError } from "#src/session/errors/LastTargetError.ts";
import { record } from "../helpers/rooms.ts";
import {
  FakeNavigator,
  FakeSessionCatalog
} from "../helpers/session/catalog.ts";

interface SetupOptions {
  current?: string;
  name?: string | null;
  confirm?: boolean;
}

function setup(
  options: SetupOptions = {}
) {
  const {
    current = "forest",
    name = null,
    confirm = true
  } = options;
  const catalog = new FakeSessionCatalog([
    {
      ...record("forest", "voxelmap"),
      path: "maps/forest.voxelmap.json"
    },
    record("tex", "pixelart"),
    {
      ...record("cave", "voxelmap"),
      path: "maps/cave.voxelmap.json"
    }
  ]);
  const navigator = new FakeNavigator();
  const prompts: PromptOptions[] = [];
  const targets = new EditorTargets({
    catalog,
    accepts: "voxelmap",
    current,
    navigator: {
      navigate: (target, tag) => {
        catalog.calls.push(`navigate ${target}`);

        return navigator.navigate(target, tag);
      }
    },
    browser: {
      prompt: (prompt) => {
        prompts.push(prompt);

        return Promise.resolve(name);
      },
      confirm: () => {
        catalog.calls.push("confirm");

        return Promise.resolve(confirm);
      }
    }
  });

  return {
    prompts,
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

  test("renaming asks for a name and keeps the folder and extension", async() => {
    const { prompts, catalog, targets } = setup({ name: " woods " });

    await targets.renameCurrent();

    assert.equal(prompts[0].defaultValue, "forest");
    assert.deepEqual(catalog.calls, ["rename forest maps/woods.voxelmap.json"]);
  });

  for (const name of [null, "", "forest"]) {
    test(`renaming to ${JSON.stringify(name)} changes nothing`, async() => {
      const { catalog, targets } = setup({ name });

      await targets.renameCurrent();

      assert.deepEqual(catalog.calls, []);
    });
  }

  for (const { current, next } of [
    { current: "cave", next: "forest" },
    { current: "forest", next: "cave" }
  ]) {
    test(`deleting ${current} opens ${next} before removing it`, async() => {
      const { catalog, targets } = setup({ current });

      await targets.removeCurrent();

      assert.deepEqual(catalog.calls, [
        "confirm",
        `navigate ${next}`,
        `remove ${current}`
      ]);
    });
  }

  test("a cancelled delete keeps the target", async() => {
    const { catalog, targets } = setup({ confirm: false });

    await targets.removeCurrent();

    assert.deepEqual(catalog.calls, ["confirm"]);
  });

  test("a target other assets use is refused before asking", async() => {
    const { catalog, targets } = setup();
    catalog.dependents.set("forest", [
      {
        ...record("hut", "voxelmodel"),
        path: "props/hut.voxelmodel.json"
      }
    ]);

    await assert.rejects(targets.removeCurrent(), {
      name: "TargetInUseError",
      dependents: ["props/hut"]
    });
    assert.deepEqual(catalog.calls, []);
  });

  test("the last target of its kind cannot be deleted", async() => {
    const { catalog, targets } = setup();
    catalog.assets = catalog.assets.filter((asset) => asset.id !== "cave");

    assert.equal(targets.canRemoveCurrent, false);
    await assert.rejects(targets.removeCurrent(), LastTargetError);
    assert.deepEqual(catalog.calls, []);
  });
});
