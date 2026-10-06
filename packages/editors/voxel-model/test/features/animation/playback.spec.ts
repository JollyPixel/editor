// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AnimationClipJSON } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import { AnimationPoser } from "#src/features/animation/AnimationPoser.ts";
import {
  AnimationPlayer,
  type PlaybackClock
} from "#src/features/animation/AnimationPlayer.ts";
import {
  timelineRows,
  unboundTimelineRows
} from "#src/features/animation/timeline/timelineRows.ts";
import { AnimationPlaybackStore } from "#src/state/index.ts";
import { createAnimatedModel } from "./fixtures.ts";

describe("AnimationPlaybackStore", () => {
  test("rounds and clamps the playhead, and tells only real changes", () => {
    const playback = new AnimationPlaybackStore();
    const changes: Array<[number, boolean]> = [];
    playback.on("change", ({ tick, playing }) => changes.push([tick, playing]));

    playback.seek(-3.6);
    playback.seek(2.4);
    playback.play();
    playback.play();

    assert.deepEqual(playback.playback, { tick: 2, playing: true });
    assert.deepEqual(changes, [[2, false], [2, true]]);
  });
});

describe("AnimationPoser", () => {
  test("poses bound blocks while Animate is open and puts the rest back when it closes", () => {
    const model = createAnimatedModel();
    const applied: Array<[string, number]> = [];
    let frames = 0;
    const poser = new AnimationPoser({
      document: model.document,
      session: model.animationSession,
      blocks: {
        applyTransform: (id, transform) => applied.push([id, transform.position.x])
      },
      requestFrame: () => frames++
    });

    model.tab.activate("animate");
    model.animationPlayback.seek(12000);
    assert.deepEqual(applied.at(-1), [model.ids.arm, 2]);

    model.tab.activate("build");
    assert.deepEqual(applied.at(-1), [model.ids.arm, 1]);
    assert.ok(frames > 0);

    applied.length = 0;
    model.animationPlayback.seek(0);
    assert.deepEqual(applied, []);
    poser.dispose();
  });

  test("follows key edits made while posing, and rebinds when the model changes", () => {
    const model = createAnimatedModel();
    const applied: number[] = [];
    const poser = new AnimationPoser({
      document: model.document,
      session: model.animationSession,
      blocks: { applyTransform: (_id, transform) => applied.push(transform.position.x) },
      requestFrame: () => undefined
    });
    model.tab.activate("animate");

    model.set.setKey(model.clipId, "Body/Arm", "position", {
      tick: 0,
      value: { x: 10, y: 0, z: 0 },
      interpolation: "step"
    });

    assert.equal(applied.at(-1), 11);

    model.document.rename(model.ids.arm, "Wing");
    assert.equal(applied.at(-1), 1);
    poser.dispose();
  });
});

describe("AnimationPlayer", () => {
  function createClock() {
    let now = 0;
    const queue = new Map<number, () => void>();
    let next = 0;
    const clock: PlaybackClock & { advance(ms: number): void; } = {
      now: () => now,
      frame: (callback) => {
        queue.set(++next, callback);

        return next;
      },
      cancel: (handle) => queue.delete(handle),
      advance(ms) {
        now += ms;
        const callbacks = [...queue.values()];
        queue.clear();
        for (const callback of callbacks) {
          callback();
        }
      }
    };

    return clock;
  }

  function createPlayer(
    clip: Pick<AnimationClipJSON, "length" | "loop">
  ) {
    const model = createAnimatedModel();
    model.set.changeClip(model.clipId, clip);
    const clock = createClock();
    const player = new AnimationPlayer({
      session: model.animationSession,
      clock
    });

    return { playback: model.animationPlayback, clock, player };
  }

  test("moves the playhead with time and wraps a loop", () => {
    const { playback, clock, player } = createPlayer({ length: 24000, loop: "loop" });

    playback.play();
    clock.advance(500);
    assert.equal(playback.playback.tick, 12000);
    clock.advance(750);
    assert.equal(playback.playback.tick, 6000);
    player.dispose();
  });

  test("stops a one-shot at its end", () => {
    const { playback, clock, player } = createPlayer({ length: 24000, loop: "once" });

    playback.play();
    clock.advance(1500);

    assert.deepEqual(playback.playback, { tick: 24000, playing: false });
    player.dispose();
  });

  test("carries on from a seek made while playing, and stops on pause", () => {
    const { playback, clock, player } = createPlayer({ length: 48000, loop: "loop" });

    playback.play();
    clock.advance(100);
    playback.seek(24000);
    clock.advance(500);
    assert.equal(playback.playback.tick, 36000);

    playback.pause();
    clock.advance(500);
    assert.equal(playback.playback.tick, 36000);
    player.dispose();
  });
});

describe("AnimationSession playback", () => {
  function createSession() {
    const model = createAnimatedModel();
    model.set.changeClip(model.clipId, { length: 48000, loop: "once" });

    return model.animationSession;
  }

  test("toggling plays and pauses, and replays a one-shot from its end", () => {
    const session = createSession();

    session.togglePlay();
    assert.equal(session.playback.playing, true);
    session.togglePlay();
    assert.equal(session.playback.playing, false);

    session.seek(48000);
    session.togglePlay();
    assert.deepEqual(session.playback, { tick: 0, playing: true });
  });

  test("stepping pauses on whole frames inside the clip; edges jump to its ends", () => {
    const session = createSession();
    session.seek(1400);
    session.togglePlay();

    session.stepFrames(1);
    assert.deepEqual(session.playback, { tick: 2000, playing: false });
    session.stepFrames(-5);
    assert.equal(session.playback.tick, 0);
    session.stepFrames(99);
    assert.equal(session.playback.tick, 48000);

    session.seekEdge("start");
    assert.equal(session.playback.tick, 0);
    session.seekEdge("end");
    assert.equal(session.playback.tick, 48000);
  });

  test("tells clip changes, playhead moves and Animate opening apart", () => {
    const model = createAnimatedModel();
    const events: string[] = [];
    model.animationSession.on("clip", () => events.push("clip"));
    model.animationSession.on("playhead", () => events.push("playhead"));
    model.animationSession.on("active", (active) => events.push(`active ${active}`));

    model.animationSession.seek(6000);
    model.set.changeClip(model.clipId, { name: "Wave 2" });
    model.tab.activate("animate");
    model.animationSession.seek(0);

    assert.deepEqual(events, ["playhead", "clip", "active true", "playhead", "playhead"]);
    assert.equal(model.animationSession.focused?.clip.name, "Wave 2");
  });

  test("follows the Animate tab, and leaving it stops playback", () => {
    const model = createAnimatedModel();
    const events: string[] = [];
    model.animationSession.on("active", (active) => events.push(`active ${active}`));

    model.tab.activate("animate");
    assert.equal(model.animationSession.active, true);
    model.animationSession.togglePlay();
    model.tab.activate("material");
    model.tab.activate("build");

    assert.equal(model.animationSession.active, false);
    assert.deepEqual(model.animationSession.playback, { tick: 0, playing: false });
    assert.deepEqual(events, ["active true", "active false"]);
  });

  test("does nothing to play without a focused clip", () => {
    const model = createAnimatedModel();
    model.animationFocus.focusSet("walk");

    model.animationSession.togglePlay();
    model.animationSession.stepFrames(3);

    assert.equal(model.animationSession.focused, null);
    assert.deepEqual(model.animationSession.playback, { tick: 0, playing: false });
  });
});

describe("timelineRows", () => {
  test("lists keyed blocks and the selected one in hierarchy order, with each key's interpolation", () => {
    const model = createAnimatedModel();
    model.set.setKey(model.clipId, "Body/Arm", "scale", {
      tick: 0,
      value: { x: 1, y: 1, z: 1 },
      interpolation: "step"
    });
    const { tree } = model.document;
    const clip = model.set.set.clip(model.clipId)!;
    const link = tree.animationSets.get("walk")!;

    assert.deepEqual(timelineRows(tree, clip, link, model.ids.body), [
      { blockId: model.ids.body, name: "Body", path: "Body", keys: [], selected: true },
      {
        blockId: model.ids.arm,
        name: "Arm",
        path: "Body/Arm",
        keys: [{ tick: 0, interpolation: "mixed" }, { tick: 24000, interpolation: "linear" }],
        selected: false
      }
    ]);
    assert.deepEqual(
      timelineRows(tree, clip, link, null).map(({ name }) => name),
      ["Arm"]
    );
  });

  test("lists the clip's unbound tracks with their state and keys until they are rebound", () => {
    const model = createAnimatedModel();
    const { document } = model;
    model.set.setKey(model.clipId, "Body/Leg", "position", {
      tick: 12000,
      value: { x: 0, y: 1, z: 0 },
      interpolation: "step"
    });
    document.remapAnimationTrack("walk", "Body/Arm", null);
    function unbound() {
      const clip = model.set.set.clip(model.clipId)!;

      return unboundTimelineRows(document.tree, clip, document.tree.animationSets.get("walk")!);
    }

    assert.deepEqual(unbound(), [
      {
        path: "Body/Arm",
        name: "Arm",
        state: "ignored",
        keys: [{ tick: 0, interpolation: "linear" }, { tick: 24000, interpolation: "linear" }]
      },
      { path: "Body/Leg", name: "Leg", state: "missing", keys: [{ tick: 12000, interpolation: "step" }] }
    ]);

    document.clearAnimationTrackRemap("walk", "Body/Arm");
    document.remapAnimationTrack("walk", "Body/Leg", "Body");

    assert.deepEqual(unbound(), []);
  });
});
