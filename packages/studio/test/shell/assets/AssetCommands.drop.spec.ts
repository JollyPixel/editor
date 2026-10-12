// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { AssetKindEntry } from "../../../src/catalog/AssetKindSet.ts";
import { AssetPath } from "../../../src/catalog/AssetPath.ts";
import {
  commandsFailingAt,
  droppedFile,
  importPlan
} from "../../helpers/assetCommands.ts";

// CONSTANTS
const kPixelArtKind: AssetKindEntry = {
  kind: "pixelart",
  label: "Pixel art",
  extension: ".pixelart",
  convertsFrom: [".png"]
};

describe("AssetCommands dropped files", () => {
  test("adds a dropped file under its name, or converted under the kind's extension", async() => {
    const { commands, created, errors } = commandsFailingAt(-1);
    const sprites = AssetPath.parse("sprites");

    await commands.add(sprites, droppedFile("hero.PNG", "png"), kPixelArtKind);
    await commands.add(sprites, droppedFile("hero.PNG", "png"));

    assert.deepEqual(created, [
      [
        "sprites/hero.pixelart",
        new TextEncoder().encode("png"),
        {
          kind: "pixelart",
          from: ".png",
          onConflict: "suffix"
        }
      ],
      [
        "sprites/hero.PNG",
        new TextEncoder().encode("png"),
        {
          kind: undefined,
          from: undefined,
          onConflict: "suffix"
        }
      ]
    ]);
    assert.deepEqual(errors, []);
  });

  test("reports a dropped file the catalog refuses", async() => {
    const { commands, errors } = commandsFailingAt(0);

    assert.equal(
      await commands.add(AssetPath.ROOT, droppedFile("hero.png"), kPixelArtKind),
      null
    );
    assert.deepEqual(errors, ['Could not add "hero.png": disk full']);
  });

  test("asks how to import an archive only when some of its assets exist", async() => {
    const fresh = commandsFailingAt(-1, { plan: importPlan(0) });
    const live = commandsFailingAt(-1, { plan: importPlan(2) });
    const dismissed = commandsFailingAt(-1, { plan: importPlan(2) });
    const asked: number[] = [];

    await fresh.commands.importArchive(droppedFile("pack.zip"), async() => "copy");
    await live.commands.importArchive(droppedFile("pack.zip"), async(plan) => {
      asked.push(plan.live.length);

      return "replace";
    });
    await dismissed.commands.importArchive(droppedFile("pack.zip"), async() => null);

    assert.deepEqual(fresh.imports, ["keep"]);
    assert.deepEqual(live.imports, ["replace"]);
    assert.deepEqual(asked, [2]);
    assert.deepEqual(dismissed.imports, []);
  });

  test("answers false for a .zip the catalog refuses to plan, and reports other failures", async() => {
    const refused = commandsFailingAt(-1);
    const offline = commandsFailingAt(-1, {
      plan: new Error("connection closed")
    });

    assert.equal(
      await refused.commands.importArchive(droppedFile("photos.zip"), async() => "keep"),
      false
    );
    assert.equal(
      await offline.commands.importArchive(droppedFile("pack.zip"), async() => "keep"),
      true
    );

    assert.deepEqual(refused.errors, []);
    assert.deepEqual(offline.errors, ['Could not import "pack.zip": connection closed']);
    assert.deepEqual([...refused.imports, ...offline.imports], []);
  });

  test("names each asset an archive import could not write", async() => {
    const { commands, errors } = commandsFailingAt(-1, {
      plan: importPlan(0),
      failed: [
        {
          id: "a",
          kind: "pixelart",
          path: "sprites/a.pixelart",
          reason: "unknown kind"
        }
      ]
    });

    await commands.importArchive(droppedFile("pack.zip"), async() => "keep");

    assert.deepEqual(errors, ['Could not import "sprites/a.pixelart": unknown kind']);
  });
});
