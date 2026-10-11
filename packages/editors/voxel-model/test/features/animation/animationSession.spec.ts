// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createAnimatedModel } from "./fixtures.ts";

describe("AnimationSession playback", () => {
  function createSession() {
    const model = createAnimatedModel();
    model.set.changeClip(model.clipId, { length: 48000 });
    model.animationPlayback.toggleLoop();

    return model.animationSession;
  }

  test("toggling plays and pauses, and replays a non-looping preview from its end", () => {
    const session = createSession();

    session.togglePlay();
    assert.equal(session.playback.playing, true);
    session.togglePlay();
    assert.equal(session.playback.playing, false);

    session.seek(48000);
    session.togglePlay();
    assert.deepEqual(session.playback, { tick: 0, playing: true, loop: false });
  });

  test("stepping pauses on whole frames inside the clip; edges jump to its ends", () => {
    const session = createSession();
    session.seek(1400);
    session.togglePlay();

    session.stepFrames(1);
    assert.deepEqual(session.playback, { tick: 2000, playing: false, loop: false });
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
    assert.deepEqual(model.animationSession.playback, { tick: 0, playing: false, loop: true });
    assert.deepEqual(events, ["active true", "active false"]);
  });

  test("switching clips rewinds and keeps playing; refocusing or reloading keeps the playhead", () => {
    const model = createAnimatedModel();
    const session = model.animationSession;
    const runId = model.set.addClip({ id: "run", name: "Run", length: 24000 })!;
    session.seek(6000);
    session.togglePlay();

    model.animationFocus.focusClip("walk", runId);
    assert.deepEqual(session.playback, { tick: 0, playing: true, loop: true });

    session.seek(3000);
    model.animationFocus.focusClip("walk", runId);
    model.set.load(model.set.set.toJSON());
    assert.equal(session.playback.tick, 3000);
  });

  test("the preview loop never touches the clip or the history; the clip's loop is an undoable edit", () => {
    const model = createAnimatedModel();
    const session = model.animationSession;
    const clipLoop = session.focused?.clip.loop;
    const history = model.history.state(model.clipScope);

    session.toggleLoop();
    assert.deepEqual([session.playback.loop, session.focused?.clip.loop], [false, clipLoop]);
    assert.deepEqual(model.history.state(model.clipScope), history);

    model.history.record(
      model.clipScope,
      null,
      () => model.set.changeClip(model.clipId, { loop: !clipLoop })
    );
    assert.equal(model.history.undo(model.clipScope), true);
    assert.equal(session.focused?.clip.loop, clipLoop);
  });

  test("does nothing to play without a focused clip", () => {
    const model = createAnimatedModel();
    model.animationFocus.focusSet("walk");

    model.animationSession.togglePlay();
    model.animationSession.stepFrames(3);

    assert.equal(model.animationSession.focused, null);
    assert.deepEqual(model.animationSession.playback, { tick: 0, playing: false, loop: true });
  });
});
