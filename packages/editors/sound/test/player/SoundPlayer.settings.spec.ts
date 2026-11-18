// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Volume } from "#src/player/volume/Volume.ts";
import { followingPlayer } from "../helpers/followingPlayer.ts";

describe("SoundPlayer with the sound settings applied", () => {
  test("plays at the pitch, volume and loop region of the settings, past the monitor volume", async() => {
    const { context, settings, player } = await followingPlayer();
    player.volume = new Volume(0.25);
    settings.preview({
      pitch: 2,
      volume: 0.5,
      loop: true,
      loopStart: 0.5,
      loopEnd: 1.5
    });
    player.retune(player.mode.withApplySettings(true));
    player.play();
    context.currentTime = 1;

    const [source] = context.sources;
    assert.equal(source.playbackRate.value, 2);
    assert.equal(source.loop, true);
    assert.equal(source.loopStart, 0.5);
    assert.equal(source.loopEnd, 1.5);
    assert.equal(context.level.gain.value, 0.5);
    assert.equal(context.output.gain.value, 1);
    assert.equal(player.elapsed, 1);
  });

  test("ignores the settings until they are applied", async() => {
    const { context, settings, player } = await followingPlayer();
    settings.preview({
      pitch: 2,
      volume: 0.5
    });
    player.play();

    assert.equal(context.sources[0].playbackRate.value, 1);
    assert.equal(context.level.gain.value, 1);
  });

  test("enters the loop region at its start when played past its end", async() => {
    const { context, settings, player } = await followingPlayer();
    settings.preview({
      loop: true,
      loopStart: 0.5,
      loopEnd: 1.5
    });
    player.retune(player.mode.withApplySettings(true));
    player.seek(0.9);
    player.play();

    assert.equal(context.sources[0].offset, 0.5);
    assert.equal(player.elapsed, 0.5);
  });

  test("retunes the playing sound while a setting is being edited", async() => {
    const { context, settings, player } = await followingPlayer();
    player.retune(player.mode.withApplySettings(true));
    player.play();
    context.currentTime = 0.5;
    settings.preview({ pitch: 2 });
    context.currentTime = 0.75;

    assert.equal(context.sources.length, 1);
    assert.equal(context.sources[0].playbackRate.value, 2);
    assert.equal(player.elapsed, 1);
  });

  test("rolls the random pitch on each play and keeps it through a seek", async(t) => {
    const { context, settings, player } = await followingPlayer();
    const random = t.mock.method(Math, "random", () => 0.75);
    settings.preview({ pitchVariation: 0.2 });
    player.retune(player.mode.withApplySettings(true));
    player.play();
    random.mock.mockImplementation(() => 0);
    player.seek(0.5);

    assert.equal(context.sources[1].playbackRate.value, 1.1);

    player.pause();
    player.play();

    assert.equal(context.sources[2].playbackRate.value, 0.8);
  });
});

describe("SoundPlayer trigger", () => {
  test("ignores a trigger during the cooldown of the previous one", async() => {
    const { context, settings, player } = await followingPlayer();
    settings.preview({ cooldown: 0.5 });

    player.trigger();
    context.currentTime = 0.2;
    player.trigger();

    assert.equal(context.sources.length, 1);

    context.currentTime = 0.6;
    player.trigger();

    assert.equal(context.sources.length, 2);
  });

  test("stops the oldest voice once Max at once is reached", async() => {
    const { context, settings, player } = await followingPlayer();
    settings.preview({ maxInstances: 2 });
    player.trigger();
    player.trigger();
    player.trigger();

    assert.deepEqual(
      context.sources.map((source) => source.stopped),
      [true, false, false]
    );
  });

  test("plays each voice at its own random pitch, without looping", async(t) => {
    const { context, settings, player } = await followingPlayer();
    const random = t.mock.method(Math, "random", () => 1);
    settings.preview({
      loop: true,
      pitchVariation: 0.5
    });
    player.trigger();
    random.mock.mockImplementation(() => 0);
    player.trigger();

    assert.deepEqual(
      context.sources.map((source) => [source.playbackRate.value, source.loop]),
      [[1.5, false], [0.5, false]]
    );
  });
});
