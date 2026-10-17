// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockTransform,
  type BlockTransformJSON
} from "@jolly-pixel/asset.voxel-model/client";
import {
  ClipSampler,
  type AnimationChannel,
  type AnimationKeyJSON
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import { AnimationKeyer } from "#src/features/animation/keys/AnimationKeyer.ts";
import { KeyInspectorController } from "#src/features/animation/keys/KeyInspectorController.ts";
import {
  createAnimatedModel,
  createHost
} from "./fixtures.ts";

function createKeying(
  tick: number
) {
  const model = createAnimatedModel();
  model.tab.activate("animate");
  model.animationPlayback.seek(tick);
  const rest = model.document.tree.block(model.ids.arm)!.transform;
  const clip = model.set.set.clip(model.clipId)!;
  const arm = {
    uuid: model.ids.arm,
    transform: new BlockTransform(rest).pose(new ClipSampler(clip).sample(tick).get("Body/Arm")!)
  };
  const resets: string[] = [];
  const keyer = new AnimationKeyer({
    document: model.document,
    history: model.history,
    session: model.animationSession,
    blocks: { get: (id) => (id === arm.uuid ? arm : undefined) },
    poser: { reset: (id) => resets.push(id) },
    access: model.access
  });
  function keys(
    channel: AnimationChannel
  ): AnimationKeyJSON[] {
    return model.set.set.clip(model.clipId)!
      .tracks.find(({ path }) => path === "Body/Arm")?.[channel] ?? [];
  }

  return { model, arm, keyer, resets, keys };
}

function moved(
  transform: BlockTransformJSON,
  patch: Partial<BlockTransformJSON>
): BlockTransformJSON {
  return { ...transform, ...patch };
}

describe("AnimationKeyer", () => {
  test("keys nothing without animation rights and puts the block back on the clip's pose", () => {
    const { model, arm, keyer, keys, resets } = createKeying(12300);
    const before = keys("position");
    model.access.grant("transforms");

    arm.transform = moved(arm.transform, { position: { x: 5, y: 0, z: 0 } });
    keyer.commit(arm);

    assert.deepEqual([keyer.writable, keys("position"), resets], [false, before, [arm.uuid]]);
  });

  test("keys the changed channels at the playhead's frame, as offsets from rest", () => {
    const { arm, keyer, keys, resets } = createKeying(12300);

    arm.transform = moved(arm.transform, {
      position: { x: 5, y: 0, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 }
    });
    keyer.commit(arm);

    assert.deepEqual(
      keys("position").map(({ tick, value }) => [tick, value.x]),
      [[0, 0], [12000, 4], [24000, 2]]
    );
    assert.deepEqual(keys("rotation"), [
      { tick: 12000, value: { x: 0, y: 90, z: 0 }, interpolation: "linear" }
    ]);
    assert.deepEqual(keys("scale"), []);
    assert.deepEqual(resets, []);
  });

  test("keeps the interpolation of a key it replaces", () => {
    const { model, arm, keyer, keys } = createKeying(0);
    model.set.writeKey(model.clipId, "Body/Arm", "position", {
      tick: 0,
      value: { x: 0, y: 0, z: 0 },
      interpolation: "step"
    });

    arm.transform = moved(arm.transform, { position: { x: 3, y: 0, z: 0 } });
    keyer.commit(arm);

    assert.deepEqual(keys("position")[0], { tick: 0, value: { x: 2, y: 0, z: 0 }, interpolation: "step" });
  });

  test("puts the pose back when an edit keys nothing", () => {
    const { model, arm, keyer, resets } = createKeying(6000);

    keyer.commit(arm);
    model.animationFocus.focusSet("walk");
    arm.transform = moved(arm.transform, { position: { x: 9, y: 0, z: 0 } });
    keyer.commit(arm);

    assert.deepEqual(resets, [arm.uuid, arm.uuid]);
    assert.equal(model.set.set.clip(model.clipId)!.tracks[0].position?.length, 2);
  });

  test("the Key action keys every channel as one undo step, and only in Animate", () => {
    const { model, keyer, keys } = createKeying(12000);
    const steps = model.history.state(model.clipScope).undoCount;

    assert.equal(keyer.keyBlock(model.ids.arm), true);
    assert.deepEqual(keys("scale"), [{ tick: 12000, value: { x: 1, y: 1, z: 1 }, interpolation: "linear" }]);
    assert.equal(keys("rotation").length, 1);
    assert.equal(model.history.state(model.clipScope).undoLabel, "Key Arm");

    model.history.undo(model.clipScope);
    assert.deepEqual([keys("scale"), keys("rotation")], [[], []]);
    assert.equal(model.history.state(model.clipScope).undoCount, steps);

    model.tab.activate("build");
    assert.equal(keyer.keyBlock(model.ids.arm), false);
  });
});

describe("KeyInspectorController", () => {
  test("shows the selected keys' interpolation, mixed when they differ, and sets it as one undo step", () => {
    const model = createAnimatedModel();
    const inspector = new KeyInspectorController(createHost());
    inspector.attach(model);
    function interpolations(): string[] {
      return model.set.set.clip(model.clipId)!.tracks[0].position!.map(({ interpolation }) => interpolation);
    }
    function state() {
      return inspector.state;
    }
    assert.equal(state(), null);

    model.set.writeKey(model.clipId, "Body/Arm", "position", {
      tick: 24000,
      value: { x: 2, y: 0, z: 0 },
      interpolation: "smooth"
    });
    model.keyEditor.select({ path: "Body/Arm", tick: 0 }, false);
    assert.deepEqual(state(), { title: "Arm @ frame 0", interpolation: "linear", editable: true });
    model.keyEditor.select({ path: "Body/Arm", tick: 24000 }, true);
    assert.deepEqual(state(), { title: "2 keys", interpolation: "mixed", editable: true });

    inspector.applyInterpolation("step");
    assert.deepEqual([interpolations(), state()?.interpolation], [["step", "step"], "step"]);
    assert.equal(model.history.state(model.clipScope).undoLabel, "Set interpolation of 2 keys");

    model.history.undo(model.clipScope);
    assert.deepEqual(interpolations(), ["linear", "smooth"]);
  });
});
