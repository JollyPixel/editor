// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Volume } from "#src/player/volume/Volume.ts";
import {
  FakeAudioContext,
  fakeBuffer
} from "../helpers/FakeAudioContext.ts";
import { followingPlayer } from "../helpers/followingPlayer.ts";

describe("SoundPlayer controls", () => {
  test("loops the sound that is playing when loop is turned on", async() => {
    const { context, player } = await followingPlayer();
    player.play();
    player.retune(player.mode.withLoop(true));
    context.currentTime = 2.5;

    assert.equal(context.sources[0].loop, true);
    assert.equal(player.elapsed, 0.5);
  });

  test("finishes the current pass when loop is turned off", async() => {
    const { context, player } = await followingPlayer();
    player.retune(player.mode.withLoop(true));
    player.play();
    context.currentTime = 4.5;
    player.retune(player.mode.withLoop(false));
    context.currentTime = 5;

    assert.equal(context.sources[0].loop, false);
    assert.equal(player.elapsed, 1);
  });

  test("changes speed without restarting the sound that is playing", async() => {
    const { context, player } = await followingPlayer();
    player.play();
    context.currentTime = 0.5;
    player.retune(player.mode.withSpeed(2));
    context.currentTime = 0.75;

    assert.equal(context.sources.length, 1);
    assert.equal(context.sources[0].playbackRate.value, 2);
    assert.equal(player.elapsed, 1);
  });

  test("plays a reversed copy of the sound from its end until it reaches the start", async() => {
    const context = new FakeAudioContext();
    context.decoded = fakeBuffer([new Float32Array([0.1, 0.2, 0.3, 0.4])], 2);
    const { player } = await followingPlayer(context);
    player.retune(player.mode.withReversed(true));
    player.play();
    context.currentTime = 0.5;

    const [source] = context.sources;
    assert.deepEqual(
      source.buffer?.getChannelData(0),
      new Float32Array([0.4, 0.3, 0.2, 0.1])
    );
    assert.equal(source.offset, 0);
    assert.equal(player.elapsed, 1.5);

    source.end();

    assert.equal(player.playing, false);
  });

  test("turns around at the playhead when the direction flips while playing", async() => {
    const { context, player } = await followingPlayer();
    player.play();
    context.currentTime = 0.5;
    player.retune(player.mode.withReversed(true));
    context.currentTime = 0.75;

    assert.equal(context.sources[0].stopped, true);
    assert.equal(context.sources[1].offset, 1.5);
    assert.equal(player.elapsed, 0.25);
  });

  test("wraps a reversed sound that loops back to its end", async() => {
    const { context, player } = await followingPlayer();
    player.retune(player.mode.withLoop(true));
    player.retune(player.mode.withReversed(true));
    player.play(0.5);
    context.currentTime = 1;

    assert.equal(player.elapsed, 1.5);
  });

  test("sets the output level to the square of the volume, within 0 and 1", async() => {
    const { context, player } = await followingPlayer();
    player.volume = new Volume(0.25);

    assert.equal(context.output.gain.value, 0.0625);

    player.volume = new Volume(2);

    assert.equal(player.volume.level, 1);
    assert.equal(context.output.gain.value, 1);
  });
});
