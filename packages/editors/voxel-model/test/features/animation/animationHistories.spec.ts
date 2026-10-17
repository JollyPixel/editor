// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AnimationChange } from "@jolly-pixel/asset.voxel-animation/client";
import {
  ModelDocument,
  type VoxelModelCommand
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  ANIMATION_LIBRARY,
  createEditorHistory,
  scopeOfModelChange
} from "#src/features/history/index.ts";
import { animationKey } from "#src/state/index.ts";
import {
  HISTORY_KEY,
  createHistoryModel
} from "./historyModel.ts";

describe("scopeOfModelChange", () => {
  test("sends bindings to their set, own set and library edits to the library, tree edits to Build", () => {
    const link = { id: "walk", kind: "voxelanimation", bindings: [] };
    const commands: VoxelModelCommand[] = [
      { action: "animation-binding-changed", id: "walk", path: "Arm", target: null },
      { action: "animation-binding-cleared", id: "own", path: "Arm" },
      { action: "animation-set-linked", link },
      { action: "animation-set-unlinked", id: "walk" },
      { action: "animation-set-linked", link: { ...link, own: true } },
      { action: "node-renamed", id: "arm", name: "Hand" }
    ];

    assert.deepEqual(
      commands.map((command) => scopeOfModelChange({ command }, { owned: { id: "own" } })),
      ["set:walk", ANIMATION_LIBRARY, ANIMATION_LIBRARY, ANIMATION_LIBRARY, null, "build"]
    );
  });

  test("a binding change files under its set's key before the set opens", () => {
    const document = new ModelDocument();
    const history = createEditorHistory({ document });
    document.linkAnimationSet({ id: "walk", kind: "voxelanimation" });

    assert.equal(document.remapAnimationTrack("walk", "Body/Arm", null), true);
    assert.equal(history.state(animationKey("walk")).undoLabel, "Ignore Body/Arm");
    assert.deepEqual(
      (["build", "material", ANIMATION_LIBRARY] as const).map((scope) => history.state(scope).undoLabel),
      [null, null, "Link animation set"]
    );
  });
});

describe("scopeOfAnimationChange", () => {
  for (const own of [false, true]) {
    test(`files an unrecorded key edit under the focused clip's key, ${own ? "own" : "shared"} set`, () => {
      const model = createHistoryModel({ own });
      const focused = model.animationSession.focused!;

      model.set.writeKey(model.clipId, "Body/Arm", "position", HISTORY_KEY);

      assert.equal(model.history.state(focused.key).undoLabel, "Key Arm");
    });
  }
});

describe("AnimationHistories", () => {
  test("files the own set's edits in the library, and a shared set's edits in the set's scope", () => {
    const model = createHistoryModel({ own: true });
    const { document, history, set } = model;
    const walkScope = animationKey("walk");

    set.removeClip("run");
    assert.equal(history.state(walkScope).canUndo, false);
    assert.equal(model.state(ANIMATION_LIBRARY).undoLabel, "Delete clip Run");

    document.shareAnimationSet("walk");
    set.changeClip(model.clipId, { name: "Hello" });
    assert.equal(history.state(walkScope).undoLabel, "Rename clip Wave");

    assert.equal(model.undo(ANIMATION_LIBRARY), true);
    assert.equal(model.state(ANIMATION_LIBRARY).undoLabel, "Delete clip Run");
  });

  test("files library edits in the library scope", () => {
    const model = createHistoryModel();
    const { animations, document } = model;

    animations.unlink("walk");
    assert.equal(model.state(ANIMATION_LIBRARY).undoLabel, "Unlink animation set");

    assert.equal(model.undo(ANIMATION_LIBRARY), true);
    assert.equal(document.tree.animationSets.has("walk"), true);
  });

  test("keeps one scope per clip, and the set's own edits in the set's scope", () => {
    const model = createHistoryModel();
    const { set } = model;

    model.key(model.wave, "Key wave");
    model.key(model.run, "Key run");
    set.changeClip("run", { fps: 12 });
    set.changeClip("run", { name: "Sprint" });

    assert.equal(model.state(model.wave).undoLabel, "Key wave");
    assert.equal(model.state(model.run).undoCount, 2);
    assert.equal(model.state(model.walkSet).undoLabel, "Rename clip Run");
    assert.equal(model.state(model.walkSet).undoCount, 2);

    assert.equal(model.undo(model.wave), true);
    assert.equal(model.toKey(model.wave.clipId), undefined);
    assert.equal(model.toKey("run"), 5);
    assert.equal(set.set.clip("run")?.fps, 12);
    assert.equal(model.state(model.walkSet).undoCount, 2, "an undo in a clip files nothing in the set");
  });

  test("drops a clip's scope with the clip, and its return starts empty", () => {
    const model = createHistoryModel();
    const { set } = model;
    model.key(model.run, "Key run");

    set.removeClip("run");
    assert.equal(model.state(model.run).canUndo, false);
    assert.equal(model.state(model.walkSet).undoLabel, "Delete clip Run");

    assert.equal(model.undo(model.walkSet), true);
    assert.equal(model.toKey("run"), 5);
    assert.equal(model.state(model.run).canUndo, false);
  });

  test("opens a history for a clip that a reload brings back", () => {
    const model = createHistoryModel();
    const { set } = model;
    set.addClip({ id: "sprint", name: "Sprint", length: 24000 });
    const snapshot = set.set.toJSON();
    set.removeClip("sprint");
    set.load(snapshot);
    const sprint = { setId: "walk", clipId: "sprint" };
    model.key(sprint, "Key sprint");

    assert.equal(model.state(sprint).undoLabel, "Key sprint");
  });

  test("keeps a clip's steps and focus while the reconciler rewinds and replays its creation", () => {
    const model = createHistoryModel();
    const { set, animationFocus } = model;
    const changes: AnimationChange[] = [];
    const unsubscribe = set.subscribe("change", (change) => changes.push(change));
    set.addClip({ id: "sprint", name: "Sprint", length: 24000 });
    unsubscribe();
    const [added] = changes;
    const sprint = { setId: "walk", clipId: "sprint" };
    model.key(sprint, "Key sprint");
    animationFocus.focusClip("walk", "sprint");

    set.revert([added.image]);
    set.replayPending(added.command);

    assert.equal(model.state(sprint).undoLabel, "Key sprint");
    assert.deepEqual(animationFocus.focus, sprint);
  });

  test("closing a set drops its scopes and its clips' scopes", () => {
    const model = createHistoryModel();
    const { animations } = model;
    const targets = [model.walkSet, model.wave, model.run];
    model.key(model.wave, "Key wave");
    model.key(model.run, "Key run");
    assert.deepEqual(targets.map((target) => model.state(target).canUndo), [true, true, true]);

    animations.unlink("walk");

    assert.deepEqual(targets.map((target) => model.state(target).canUndo), [false, false, false]);
  });

  test("a peer's key edit refuses only the clip step that wrote it", () => {
    const model = createHistoryModel();
    const { set } = model;
    model.key(model.wave, "Key wave");
    model.key(model.run, "Key run");

    set.apply({
      action: "key-set",
      clipId: "run",
      path: "Body/Arm",
      channel: "position",
      key: { ...HISTORY_KEY, value: { x: 9, y: 0, z: 0 } }
    }, "peer");

    assert.equal(model.state(model.run).refused.length, 1);
    assert.equal(model.state(model.wave).refused.length, 0);
  });
});
