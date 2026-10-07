// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AnimationFollow,
  followingBuildEdits
} from "#src/features/animation/AnimationFollow.ts";
import { ModelHierarchy } from "#src/model/index.ts";
import { createAnimatedModel } from "./fixtures.ts";

function createFollowing(
  options: { own?: boolean; } = {}
) {
  const model = createAnimatedModel(options);
  const { document, animations, history } = model;
  const hierarchy = new ModelHierarchy({
    document,
    edits: followingBuildEdits(history, new AnimationFollow({ document, animations })),
    textureSize: () => {
      return { x: 256, y: 256 };
    },
    poses: {
      under: (uuid) => document.tree.block(uuid)!.transform,
      mirror: () => []
    }
  });

  return {
    ...model,
    hierarchy,
    trackPaths: () => model.set.set.clip(model.clipId)!.tracks.map(({ path }) => path),
    bindings: () => document.tree.animationSets.get("walk")?.bindings ?? []
  };
}

describe("AnimationFollow", () => {
  test("renaming a parent remaps a shared set's tracks below it, undone with the rename", () => {
    const { hierarchy, history, ids, trackPaths, bindings } = createFollowing();
    const animateSteps = history.state("animate").undoCount;

    hierarchy.rename(ids.body, "Torso");
    assert.deepEqual(bindings(), [{ path: "Body/Arm", target: "Torso/Arm" }]);
    assert.deepEqual(trackPaths(), ["Body/Arm"]);
    assert.equal(history.state("animate").undoCount, animateSteps);

    assert.equal(history.state("build").undoLabel, "Rename Body");
    assert.equal(history.undo("build"), true);
    assert.deepEqual(bindings(), []);
  });

  test("renaming a block renames the track paths of the model's own clips", () => {
    const { hierarchy, history, ids, trackPaths, bindings } = createFollowing({ own: true });

    hierarchy.rename(ids.body, "Torso");
    assert.deepEqual(trackPaths(), ["Torso/Arm"]);
    assert.deepEqual(bindings(), []);

    assert.equal(history.undo("build"), true);
    assert.deepEqual(trackPaths(), ["Body/Arm"]);
  });

  test("an own track no clip can fully rename is remapped instead, leaving every clip as it was", () => {
    const { hierarchy, ids, set, trackPaths, bindings } = createFollowing({ own: true });
    set.addClip({ id: "run", name: "Run", tracks: [{ path: "Body/Arm" }, { path: "Torso/Arm" }] });

    hierarchy.rename(ids.body, "Torso");
    assert.deepEqual(trackPaths(), ["Body/Arm"]);
    assert.deepEqual(set.set.clip("run")?.tracks.map(({ path }) => path), ["Body/Arm", "Torso/Arm"]);
    assert.deepEqual(bindings(), [{ path: "Body/Arm", target: "Torso/Arm" }]);
  });

  test("a reparent remaps, moving back clears the remap, and a folder-only move writes nothing", () => {
    const { document, hierarchy, ids, bindings } = createFollowing();
    const limbs = document.tree.get(ids.arm)!.parentId;

    hierarchy.move(ids.arm, null);
    assert.deepEqual(bindings(), [{ path: "Body/Arm", target: "Arm" }]);

    hierarchy.move(ids.arm, limbs);
    assert.deepEqual(bindings(), []);

    const group = document.addFolder({ name: "Group", parentId: ids.body })!;
    hierarchy.move(ids.arm, group);
    assert.deepEqual(bindings(), []);
  });
});
