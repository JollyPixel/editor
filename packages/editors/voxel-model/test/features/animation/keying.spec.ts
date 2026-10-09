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
import { TimelineController } from "#src/features/animation/timeline/TimelineController.ts";
import { KeyInspectorController } from "#src/features/animation/keys/KeyInspectorController.ts";
import { animationKey } from "#src/state/index.ts";
import {
  restTarget,
  TransformTool,
  type TransformTarget
} from "#src/features/transform/TransformTool.ts";
import {
  createAnimatedModel,
  createHost
} from "./fixtures.ts";
import { createModelFixture } from "../../fixtures/model.ts";

function target(
  modes: TransformTarget["modes"]
): TransformTarget {
  return {
    modes,
    end: () => undefined,
    commit: () => undefined
  };
}

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
    poser: { reset: (id) => resets.push(id) }
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

describe("TransformTool", () => {
  test("reads a mode the target does not edit as its first, and remembers it for later", () => {
    const build = target(["pos", "size", "scale"]);
    const animate = target(["pos", "scale"]);
    const tool = new TransformTool(build);
    let changes = 0;
    tool.on("change", () => changes++);

    tool.mode = "size";
    tool.use(animate);
    assert.equal(tool.mode, "pos");
    tool.mode = "size";
    assert.equal(tool.mode, "pos");

    tool.use(build);
    assert.equal(tool.mode, "size");
    assert.equal(changes, 3);
  });

  test("the rest target locks a drag and commits it to the model", () => {
    const calls: string[] = [];
    const rest = restTarget({
      blocks: { commitTransform: (uuid) => calls.push(`commit ${uuid}`) },
      lock: {
        claim: (uuid) => calls.push(`claim ${uuid}`),
        release: () => calls.push("release")
      }
    });
    const block = createModelFixture().addBlock();
    const { uuid } = block;

    rest.begin?.(block);
    rest.end(block);
    rest.commit(block);

    assert.deepEqual(calls, [
      `claim ${uuid}`,
      `commit ${uuid}`,
      "release",
      `commit ${uuid}`
    ]);
  });
});

describe("AnimationKeyer", () => {
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
    model.set.setKey(model.clipId, "Body/Arm", "position", {
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

describe("KeyEditor through the timeline", () => {
  function createTimeline() {
    const model = createAnimatedModel();
    const host = createHost();
    const playheads: Array<number | null> = [];
    const timeline = new TimelineController(host, {
      showPlayhead: (fraction) => playheads.push(fraction)
    });
    timeline.attach(model);
    function ticks(): number[] {
      return model.set.set.clip(model.clipId)!.tracks[0]?.position?.map(({ tick }) => tick) ?? [];
    }

    return { model, host, playheads, timeline, keys: model.keyEditor, ticks };
  }

  test("moves the playhead without rendering the rows again", () => {
    const { model, host, playheads } = createTimeline();
    const renders = host.updates;

    model.animationPlayback.seek(6000);
    model.animationPlayback.seek(48000);

    assert.equal(host.updates, renders);
    assert.deepEqual(playheads.slice(-2), [0.25, null]);
  });

  test("shows peers on the same clip only, within its length, and rings their keys", () => {
    const { model, timeline } = createTimeline();
    const wave = animationKey("walk", model.clipId);
    const run = animationKey("walk", "run");
    const keys = [{ path: "Body/Arm", tick: 24000 }];
    function peer(clientId: string) {
      return { clientId, displayName: clientId, color: `#${clientId}` };
    }

    const { rows } = timeline.view!;

    model.presence.animateCursors = [
      { peer: peer("bob"), cursor: { clip: wave, tick: 12000, keys } },
      { peer: peer("ann"), cursor: { clip: wave, tick: 48000, keys } },
      { peer: peer("eve"), cursor: { clip: run, tick: 6000, keys } }
    ];

    assert.deepEqual(timeline.view!.peers.map(({ peer }) => peer.clientId), ["bob"]);
    assert.deepEqual([...timeline.view!.peerKeys], [["24000:Body/Arm", "#bob"]]);
    assert.equal(timeline.view!.rows, rows, "peer cursors leave the rows alone");
  });

  test("moves selected keys by frames, held inside the clip, and keeps them selected", () => {
    const { timeline, keys, ticks } = createTimeline();

    keys.select({ path: "Body/Arm", tick: 0 }, false);
    keys.move(3);
    assert.deepEqual(ticks(), [3000, 24000]);
    assert.deepEqual([...timeline.view!.selectedKeys], ["3000:Body/Arm"]);

    keys.select({ path: "Body/Arm", tick: 24000 }, true);
    keys.move(5);
    assert.deepEqual(ticks(), [3000, 24000]);
  });

  test("deletes, copies and pastes selected keys at the playhead's frame", () => {
    const { model, timeline, keys, ticks } = createTimeline();

    keys.select({ path: "Body/Arm", tick: 24000 }, false);
    keys.copy();
    model.animationPlayback.seek(6100);
    keys.paste();
    assert.deepEqual(ticks(), [0, 6000, 24000]);
    assert.deepEqual([...timeline.view!.selectedKeys], ["6000:Body/Arm"]);

    keys.select({ path: "Body/Arm", tick: 0 }, true);
    keys.remove();
    assert.deepEqual(ticks(), [24000]);
    assert.equal(timeline.view!.selectedKeys.size, 0);

    model.history.undo(model.clipScope);
    assert.deepEqual(ticks(), [0, 6000, 24000], "the delete of two keys undoes as one step");
  });

  test("clicking a selected key keeps the selection; additive clicks toggle; a lone pick seeks", () => {
    const { model, timeline, keys } = createTimeline();
    function tick(): number {
      return model.animationSession.playback.tick;
    }

    keys.select({ path: "Body/Arm", tick: 24000 }, false);
    assert.equal(tick(), 24000);
    keys.select({ path: "Body/Arm", tick: 0 }, false);
    assert.equal(tick(), 0);
    keys.select({ path: "Body/Arm", tick: 24000 }, true);
    keys.select({ path: "Body/Arm", tick: 24000 }, false);
    assert.deepEqual([timeline.view!.selectedKeys.size, tick()], [2, 0]);

    keys.select({ path: "Body/Arm", tick: 0 }, true);
    assert.deepEqual([...timeline.view!.selectedKeys], ["24000:Body/Arm"]);

    keys.clear();
    assert.equal(timeline.view!.selectedKeys.size, 0);
  });

  test("pressing a key selects its block; an additive press that drops the key leaves the block", () => {
    const { model, timeline } = createTimeline();
    const arm = timeline.view!.rows.find((row) => row.blockId === model.ids.arm)!;

    timeline.pressKey(arm, 0, false);
    assert.equal(model.selection.selected, model.ids.arm);

    model.selection.select(model.ids.body);
    timeline.pressKey(arm, 0, true);
    assert.deepEqual(
      [model.selection.selected, timeline.view!.selectedKeys.size],
      [model.ids.body, 0]
    );

    timeline.pressKey(arm, 24000, true);
    assert.equal(model.selection.selected, model.ids.arm);
  });

  test("the key menu acts on the selection: interpolation, copy, and delete in one undo step", () => {
    const { model, timeline, keys, ticks } = createTimeline();
    const point = { x: 0, y: 0 };
    assert.equal(timeline.keyMenu().items.length, 0, "no menu without a selected key");

    keys.select({ path: "Body/Arm", tick: 0 }, false);
    keys.select({ path: "Body/Arm", tick: 24000 }, true);

    void timeline.keyMenu().run("step", point);
    assert.equal(keys.interpolation, "step");
    const [interpolation] = timeline.keyMenu().items;
    assert.ok(interpolation !== "separator" && interpolation.items !== undefined);
    assert.deepEqual(
      interpolation.items.map((item) => item !== "separator" && item.disabled),
      [true, false, false],
      "the current interpolation is disabled"
    );

    void timeline.keyMenu().run("copy", point);
    void timeline.keyMenu().run("delete", point);
    assert.deepEqual(ticks(), []);
    model.history.undo(model.clipScope);
    assert.deepEqual(ticks(), [0, 24000]);

    model.animationPlayback.seek(6000);
    keys.paste();
    assert.ok(ticks().includes(6000), "the copied keys paste at the playhead");
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

    model.set.setKey(model.clipId, "Body/Arm", "position", {
      tick: 24000,
      value: { x: 2, y: 0, z: 0 },
      interpolation: "smooth"
    });
    model.keyEditor.select({ path: "Body/Arm", tick: 0 }, false);
    assert.deepEqual(state(), { title: "Arm @ frame 0", interpolation: "linear" });
    model.keyEditor.select({ path: "Body/Arm", tick: 24000 }, true);
    assert.deepEqual(state(), { title: "2 keys", interpolation: "mixed" });

    inspector.setInterpolation("step");
    assert.deepEqual([interpolations(), state()?.interpolation], [["step", "step"], "step"]);
    assert.equal(model.history.state(model.clipScope).undoLabel, "Set interpolation of 2 keys");

    model.history.undo(model.clipScope);
    assert.deepEqual(interpolations(), ["linear", "smooth"]);
  });
});
