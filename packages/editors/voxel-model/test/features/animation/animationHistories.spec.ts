// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  AnimationChange,
  AnimationKeyJSON
} from "@jolly-pixel/asset.voxel-animation/client";
import {
  ModelDocument,
  type VoxelModelCommand
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  ActiveHistory,
  ANIMATION_LIBRARY,
  animationScope,
  createEditorHistory,
  scopeOfModelChange
} from "#src/features/history/index.ts";
import {
  animationKey,
  type AnimationFocus
} from "#src/state/index.ts";
import { createAnimatedModel } from "./fixtures.ts";

type HistoryTarget = AnimationFocus | typeof ANIMATION_LIBRARY;

// CONSTANTS
const kKey: AnimationKeyJSON = {
  tick: 12000,
  value: { x: 5, y: 0, z: 0 },
  interpolation: "linear"
};

function createModel(
  options: { own?: boolean; } = {}
) {
  const model = createAnimatedModel(options);
  const run = model.set.addClip({ id: "run", name: "Run", length: 24000 })!;
  function scope(
    target: HistoryTarget
  ) {
    return target === ANIMATION_LIBRARY ?
      target :
      animationScope(target, model.document.tree.animationSets);
  }

  return {
    ...model,
    wave: model.clipRef,
    run: { setId: "walk", clipId: run },
    walkSet: { setId: "walk", clipId: null },
    state: (target: HistoryTarget) => model.history.state(scope(target)),
    undo: (target: HistoryTarget) => model.history.undo(scope(target)),
    active: () => new ActiveHistory({
      history: model.history,
      tab: model.tab,
      animate: model.historyFocus
    }),
    key: (target: { setId: string; clipId: string; }, label: string) => model.history.record(
      scope(target),
      label,
      () => model.set.setKey(target.clipId, "Body/Arm", "position", kKey)
    ),
    keyOf: (clipId: string) => model.set.set.keyAt(clipId, "Body/Arm", "position", kKey.tick)?.value.x
  };
}

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
      const model = createModel({ own });
      const focused = model.animationSession.focused!;

      model.set.setKey(model.clipId, "Body/Arm", "position", kKey);

      assert.equal(model.history.state(focused.key).undoLabel, "Key Arm");
    });
  }
});

describe("AnimationHistories", () => {
  test("files the own set's edits in the library, and a shared set's edits in the set's scope", () => {
    const model = createModel({ own: true });
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
    const model = createModel();
    const { animations, document } = model;

    animations.unlink("walk");
    assert.equal(model.state(ANIMATION_LIBRARY).undoLabel, "Unlink animation set");

    assert.equal(model.undo(ANIMATION_LIBRARY), true);
    assert.equal(document.tree.animationSets.has("walk"), true);
  });

  test("keeps one scope per clip, and the set's own edits in the set's scope", () => {
    const model = createModel();
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
    assert.equal(model.keyOf(model.wave.clipId), undefined);
    assert.equal(model.keyOf("run"), 5);
    assert.equal(set.set.clip("run")?.fps, 12);
    assert.equal(model.state(model.walkSet).undoCount, 2, "an undo in a clip files nothing in the set");
  });

  test("drops a clip's scope with the clip, and its return starts empty", () => {
    const model = createModel();
    const { set } = model;
    model.key(model.run, "Key run");

    set.removeClip("run");
    assert.equal(model.state(model.run).canUndo, false);
    assert.equal(model.state(model.walkSet).undoLabel, "Delete clip Run");

    assert.equal(model.undo(model.walkSet), true);
    assert.equal(model.keyOf("run"), 5);
    assert.equal(model.state(model.run).canUndo, false);
  });

  test("opens a history for a clip that a reload brings back", () => {
    const model = createModel();
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
    const model = createModel();
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
    const model = createModel();
    const { animations } = model;
    const targets = [model.walkSet, model.wave, model.run];
    model.key(model.wave, "Key wave");
    model.key(model.run, "Key run");
    assert.deepEqual(targets.map((target) => model.state(target).canUndo), [true, true, true]);

    animations.unlink("walk");

    assert.deepEqual(targets.map((target) => model.state(target).canUndo), [false, false, false]);
  });

  test("a peer's key edit refuses only the clip step that wrote it", () => {
    const model = createModel();
    const { set } = model;
    model.key(model.wave, "Key wave");
    model.key(model.run, "Key run");

    set.apply({
      action: "key-set",
      clipId: "run",
      path: "Body/Arm",
      channel: "position",
      key: { ...kKey, value: { x: 9, y: 0, z: 0 } }
    }, "peer");

    assert.equal(model.state(model.run).refused.length, 1);
    assert.equal(model.state(model.wave).refused.length, 0);
  });
});

describe("ActiveHistory", () => {
  function createActive(
    options: { own?: boolean; } = {}
  ) {
    const model = createModel(options);

    return { ...model, active: model.active() };
  }

  test("undoes in the focused clip, then the focused set, and the tab outside Animate", () => {
    const model = createActive();
    const { active, animationFocus, tab } = model;
    model.key(model.run, "Key run");
    tab.activate("animate");

    assert.equal(active.state.canUndo, false);
    assert.equal(active.targetName, "Wave");

    animationFocus.focusClip("walk", "run");
    assert.equal(active.state.undoLabel, "Key run");
    assert.equal(active.undo(), true);
    assert.equal(model.keyOf("run"), undefined);

    animationFocus.focusSet("walk");
    assert.equal(active.targetName, "Walk");
    assert.equal(active.state.undoLabel, "Add clip Run");

    tab.activate("build");
    assert.equal(active.targetName, null);
    assert.equal(active.state.canUndo, false);
  });

  test("a focused clip without a history has nothing to undo or redo", () => {
    const { active, animationFocus, tab } = createActive();
    tab.activate("animate");
    animationFocus.focusClip("walk", "ghost");

    assert.equal(active.state.canUndo, false);
    assert.equal(active.undo(), false);
    assert.equal(active.redo(), false);
  });

  test("with nothing focused, undoes in the library, which holds the own set's steps", () => {
    const model = createActive({ own: true });
    const { active } = model;
    model.tab.activate("animate");
    model.animationFocus.focusSet(null);

    model.set.removeClip(model.clipId);
    assert.equal(active.targetName, "this model");
    assert.equal(active.state.undoLabel, "Delete clip Wave");
    assert.equal(model.history.state(ANIMATION_LIBRARY).undoLabel, "Delete clip Wave");

    assert.equal(active.undo(), true);
    assert.equal(model.set.set.clip(model.clipId)?.name, "Wave");
  });

  test("tells listeners when the focused history changes, and moves to the set when its clip goes", () => {
    const model = createActive();
    const { active, tab, animationFocus, set } = model;
    tab.activate("animate");
    animationFocus.focusClip("walk", "run");
    const counts: number[] = [];
    active.on("change", (state) => counts.push(state.undoCount));

    model.key(model.wave, "Key wave");
    model.key(model.run, "Key run");
    assert.deepEqual(counts, [1]);

    set.removeClip("run");
    assert.equal(active.state.undoLabel, "Delete clip Run");
    assert.equal(counts.at(-1), active.state.undoCount);
  });

  test("tells listeners when the focused clip is renamed", () => {
    const model = createActive();
    const { active, tab, animationFocus, set } = model;
    tab.activate("animate");
    animationFocus.focusClip("walk", "run");
    const names: (string | null)[] = [];
    active.on("change", () => names.push(active.targetName));

    set.changeClip(model.clipId, { name: "Hello" });
    set.changeClip("run", { name: "Sprint" });

    assert.deepEqual(names, ["Sprint"]);
  });
});
