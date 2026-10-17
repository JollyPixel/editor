// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ANIMATION_LIBRARY } from "#src/features/history/index.ts";
import { createHistoryModel } from "./historyModel.ts";

function createActive(
  options: { own?: boolean; } = {}
) {
  const model = createHistoryModel(options);

  return { ...model, active: model.active() };
}

describe("ActiveHistory", () => {
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
    assert.equal(model.toKey("run"), undefined);

    animationFocus.focusSet("walk");
    assert.equal(active.targetName, "Walk");
    assert.equal(active.state.undoLabel, "Add clip Run");

    tab.activate("build");
    assert.equal(active.targetName, null);
    assert.equal(active.state.canUndo, false);
  });

  test("a read-only viewer can neither undo nor redo, and is told when rights change", () => {
    const model = createActive();
    const { active, animationFocus, tab } = model;
    model.key(model.run, "Key run");
    tab.activate("animate");
    animationFocus.focusClip("walk", "run");
    let changes = 0;
    active.on("change", () => changes++);

    model.access.grant();

    assert.deepEqual([active.readOnly, active.undo(), changes], [true, false, 1]);
    assert.notEqual(model.toKey("run"), undefined);

    model.access.grant("animations");
    assert.deepEqual([active.readOnly, active.undo()], [false, true]);
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
