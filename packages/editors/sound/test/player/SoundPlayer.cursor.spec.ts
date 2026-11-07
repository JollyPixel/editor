// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { followingPlayer } from "../helpers/followingPlayer.ts";

// CONSTANTS
const kOtherOggBytes = new Uint8Array([0x4F, 0x67, 0x67, 0x53, 0x00]);

describe("SoundPlayer cursor", () => {
  test("resumes from where it was paused", async() => {
    const { context, player } = await followingPlayer();
    player.play();
    context.currentTime = 0.5;
    player.pause();
    context.currentTime = 1;

    assert.equal(player.playing, false);
    assert.equal(player.position, 0.5);
    assert.equal(player.timecode(), "0:00.5 / 0:02.0");

    player.play();

    assert.equal(context.sources[1].offset, 0.5);
  });

  test("moves the cursor without playing when seeking while paused", async() => {
    const { context, player } = await followingPlayer();
    player.seek(0.25);

    assert.equal(player.playing, false);
    assert.equal(context.sources.length, 0);
    assert.equal(player.position, 0.5);

    player.play();

    assert.equal(context.sources[0].offset, 0.5);
  });

  for (const { direction, reversed, end, replayed } of [
    {
      direction: "forward",
      reversed: false,
      end: 2,
      replayed: 0.5
    },
    {
      direction: "backward",
      reversed: true,
      end: 0,
      replayed: 1.5
    }
  ]) {
    test(`replays from the start once the sound played ${direction} to its end`, async() => {
      const { context, player } = await followingPlayer();
      player.retune(player.mode.withReversed(reversed));
      player.play();
      context.currentTime = 2;
      context.sources[0].end();

      assert.equal(player.position, end);

      player.play();
      context.currentTime = 2.5;

      assert.equal(player.elapsed, replayed);
    });
  }

  test("returns the cursor to the start when another sound loads", async() => {
    const { context, document, player } = await followingPlayer();
    player.play();
    context.currentTime = 0.5;
    player.pause();
    const reloaded = new Promise<void>((resolve) => {
      const unsubscribe = player.subscribe("sound", () => {
        unsubscribe();
        resolve();
      });
    });
    document.load(kOtherOggBytes);
    await reloaded;

    assert.equal(player.position, 0);
  });
});
