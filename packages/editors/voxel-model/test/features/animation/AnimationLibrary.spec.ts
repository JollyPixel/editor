// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  AnimationLibrary,
  type AnimationSetSource
} from "#src/features/animation/library/AnimationLibrary.ts";
import { AnimationHistories } from "#src/features/animation/undo/AnimationHistories.ts";
import {
  ANIMATION_LIBRARY,
  createEditorHistory
} from "#src/features/history/index.ts";
import { modelAccess } from "../../fixtures/modelAccess.ts";
import {
  createSetSource,
  createSharedSetSource
} from "./panelHarness.ts";

function createLibrary(
  document: ModelDocument,
  source: AnimationSetSource,
  access = modelAccess()
): AnimationLibrary {
  return new AnimationLibrary({ document, source, access });
}

describe("AnimationLibrary", () => {
  test("opens a set when linked and releases it when unlinked", () => {
    const document = new ModelDocument();
    const source = createSharedSetSource();
    const library = createLibrary(document, source);

    assert.equal(library.link("shared"), true);
    assert.deepEqual(source.opened, ["shared"]);
    assert.deepEqual(
      library.sets().map(({ id, name, users }) => [id, name, users]),
      [["shared", "Humanoid", 3]]
    );
    assert.deepEqual(library.linkable(), []);

    library.unlink("shared");
    assert.deepEqual(source.released, ["shared"]);
    assert.deepEqual(library.sets(), []);
  });

  test("without animation rights changes no link or clip, and relays a set's refusals", async() => {
    const document = new ModelDocument();
    const source = createSharedSetSource();
    const access = modelAccess();
    const library = createLibrary(document, source, access);
    library.link("shared");
    const denied: string[] = [];
    library.on("setDenied", (setId) => denied.push(setId));
    access.grant("hierarchy");

    assert.equal(library.unlink("shared"), false);
    assert.equal(await library.addClip("shared", "Wave"), null);
    await assert.rejects(library.create("Run"), /only view/);
    await assert.rejects(library.ensureOwnSet(), /only view/);
    const linked = [...document.tree.animationSets.values()].map(({ id }) => id);
    assert.deepEqual([linked, source.documents.get("shared")!.set.size], [["shared"], 0]);

    source.deny("shared");
    assert.deepEqual(denied, ["shared"]);

    library.dispose();
    source.deny("shared");
    assert.deepEqual(denied, ["shared"]);
  });

  test("creates a set asset and links it", async() => {
    const document = new ModelDocument();
    const library = createLibrary(document, createSetSource());

    const id = await library.create("Walk");

    assert.deepEqual(
      [...document.tree.animationSets.values()],
      [{ id, kind: "voxelanimation", bindings: [] }]
    );
    assert.equal(library.set(id)?.name, "Walk");
  });

  test("creates the model's own set once, even when asked twice at the same time", async() => {
    const document = new ModelDocument();
    const library = createLibrary(document, createSetSource());

    const [first, second] = await Promise.all([library.ensureOwnSet(), library.ensureOwnSet()]);

    assert.equal(first, second);
    assert.deepEqual(document.tree.animationSets.owned, {
      id: first,
      kind: "voxelanimation",
      bindings: [],
      own: true
    });
    assert.equal(library.ownSet()?.name, "Robot");
    assert.equal(await library.ensureOwnSet(), first);
  });

  test("a first clip of the model is one library undo step, which keeps the own set linked", async() => {
    const document = new ModelDocument();
    const history = createEditorHistory({ document });
    const library = createLibrary(document, createSetSource());
    new AnimationHistories({
      history,
      document,
      animations: library
    });

    const ref = await library.addClip(null, "Walk");

    assert.equal(history.state(ANIMATION_LIBRARY).undoCount, 1);
    assert.equal(history.undo(ANIMATION_LIBRARY), true);
    assert.equal(library.ownSet()?.id, ref?.setId);
    assert.equal(library.ownSet()?.document.set.size, 0);
    assert.equal(history.state(ANIMATION_LIBRARY).canUndo, false);
  });

  test("shares the own set under a new name", async() => {
    const document = new ModelDocument();
    const library = createLibrary(document, createSetSource());
    const id = await library.ensureOwnSet();

    await library.share(id, "Humanoid");

    assert.equal(library.ownSet(), undefined);
    assert.deepEqual(library.sets().map(({ name, own }) => [name, own]), [["Humanoid", false]]);
  });

  test("tells listeners when a set or the catalog changes, and stops on dispose", () => {
    const document = new ModelDocument();
    const source = createSharedSetSource();
    const library = createLibrary(document, source);
    library.link("shared");
    let changes = 0;
    library.on("change", () => changes++);

    source.documents.get("shared")!.addClip({ name: "Idle" });
    source.notify();
    assert.equal(changes, 2);

    library.dispose();
    assert.deepEqual(source.released, ["shared"]);
    source.notify();
    assert.equal(changes, 2);
  });
});
