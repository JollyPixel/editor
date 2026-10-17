// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TimelineController } from "#src/features/animation/timeline/TimelineController.ts";
import { animationKey } from "#src/state/index.ts";
import {
  createAnimatedModel,
  createHost
} from "./fixtures.ts";

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

describe("KeyEditor through the timeline", () => {
  test("without animation rights edits no key and keeps only Copy in the key menu", () => {
    const { model, timeline, keys, ticks } = createTimeline();
    keys.select({ path: "Body/Arm", tick: 0 }, false);
    keys.copy();
    const before = ticks();
    model.access.grant("hierarchy");

    keys.move(2);
    keys.remove();
    keys.paste();
    keys.applyInterpolation("step");

    assert.deepEqual(ticks(), before);
    assert.equal(model.set.set.clip(model.clipId)!.tracks[0].position![0].interpolation, "linear");
    assert.deepEqual(
      timeline.keyMenu().items.flatMap((entry) => (
        entry === "separator" || entry.disabled === true || entry.items !== undefined ? [] : [entry.label]
      )),
      ["Copy"]
    );
  });

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
