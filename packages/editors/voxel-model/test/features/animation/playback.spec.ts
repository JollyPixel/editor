// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AnimationPoser } from "#src/features/animation/session/AnimationPoser.ts";
import { AnimationPlayer } from "#src/features/animation/session/AnimationPlayer.ts";
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
    playback.toggleLoop();

    assert.deepEqual(playback.playback, { tick: 2, playing: true, loop: false });
    assert.deepEqual(changes, [[2, false], [2, true], [2, true]]);
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

    model.set.writeKey(model.clipId, "Body/Arm", "position", {
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
  function createPlayer(
    t: TestContext,
    options: {
      length: number;
      clipLoop?: boolean;
      previewLoop?: boolean;
    }
  ) {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
    t.mock.method(performance, "now", () => Date.now());
    const {
      length,
      clipLoop = false,
      previewLoop = true
    } = options;
    const model = createAnimatedModel();
    model.set.changeClip(model.clipId, { length, loop: clipLoop });
    if (!previewLoop) {
      model.animationPlayback.toggleLoop();
    }
    const player = new AnimationPlayer({ session: model.animationSession });

    return { playback: model.animationPlayback, advance: (ms: number) => t.mock.timers.tick(ms), player };
  }

  test("moves the playhead with time and wraps while the preview loops, whatever the clip's loop", (t) => {
    const { playback, advance, player } = createPlayer(t, { length: 24000, clipLoop: false });

    playback.play();
    advance(500);
    assert.equal(playback.playback.tick, 12000);
    advance(750);
    assert.equal(playback.playback.tick, 6000);
    player.dispose();
  });

  test("stops at the end when the preview does not loop, even for a looping clip", (t) => {
    const { playback, advance, player } = createPlayer(t, {
      length: 24000,
      clipLoop: true,
      previewLoop: false
    });

    playback.play();
    advance(1500);

    assert.deepEqual(playback.playback, { tick: 24000, playing: false, loop: false });
    player.dispose();
  });

  test("turning the preview loop off while playing finishes the current pass", (t) => {
    const { playback, advance, player } = createPlayer(t, { length: 24000 });

    playback.play();
    advance(1250);
    playback.toggleLoop();
    advance(500);
    assert.deepEqual([playback.playback.tick, playback.playback.playing], [18000, true]);
    advance(500);
    assert.deepEqual([playback.playback.tick, playback.playback.playing], [24000, false]);
    player.dispose();
  });

  test("carries on from a seek made while playing, and stops on pause", (t) => {
    const { playback, advance, player } = createPlayer(t, { length: 48000 });

    playback.play();
    advance(100);
    playback.seek(24000);
    advance(500);
    assert.equal(playback.playback.tick, 36000);

    playback.pause();
    advance(500);
    assert.equal(playback.playback.tick, 36000);
    player.dispose();
  });
});
