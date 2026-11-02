// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { encodeContent } from "@jolly-pixel/asset-server";
import { SoundDocument } from "@jolly-pixel/asset.sound/client";

// Import Internal Dependencies
import { SoundPlayer } from "#src/playback/SoundPlayer.ts";
import {
  FakeAudioContext,
  fakeBuffer
} from "../helpers/FakeAudioContext.ts";

// CONSTANTS
const kOggBytes = new Uint8Array([0x4F, 0x67, 0x67, 0x53]);
const kOtherOggBytes = new Uint8Array([0x4F, 0x67, 0x67, 0x53, 0x00]);

async function followingPlayer(
  context = new FakeAudioContext()
): Promise<{
  context: FakeAudioContext;
  document: SoundDocument;
  player: SoundPlayer;
}> {
  const player = new SoundPlayer(context.asAudioContext());
  const document = new SoundDocument();
  document.load(encodeContent(kOggBytes));
  await player.follow(document);

  return {
    context,
    document,
    player
  };
}

function nextSound(
  player: SoundPlayer
): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = player.subscribe("sound", () => {
      unsubscribe();
      resolve();
    });
  });
}

describe("SoundPlayer", () => {
  test("stops playing when the sound reaches its end", async() => {
    const { context, player } = await followingPlayer();
    player.play();
    context.currentTime = 1.5;
    assert.equal(player.readout().playhead, 0.75);

    context.sources[0].end();

    assert.equal(player.playing, false);
    assert.equal(player.readout().playhead, null);
  });

  test("holds the playhead at the end until the sound reports it ended", async() => {
    const { context, player } = await followingPlayer();
    player.play();
    context.currentTime = 2.05;

    assert.deepEqual(player.readout(), {
      status: "ready",
      time: "0:02.0 / 0:02.0",
      format: "44.1 kHz · Mono",
      playhead: 1
    });
  });

  test("loops the sound that is playing when loop is turned on", async() => {
    const { context, player } = await followingPlayer();
    player.play();
    player.loop = true;
    context.currentTime = 2.5;

    assert.equal(context.sources[0].loop, true);
    assert.equal(player.readout().playhead, 0.25);
  });

  test("finishes the current pass when loop is turned off", async() => {
    const { context, player } = await followingPlayer();
    player.loop = true;
    player.play();
    context.currentTime = 4.5;
    player.loop = false;
    context.currentTime = 5;

    assert.equal(context.sources[0].loop, false);
    assert.equal(player.readout().playhead, 0.5);
  });

  test("keeps playing after a restart when the replaced playback reports its end", async() => {
    const { context, player } = await followingPlayer();
    player.play();
    player.play();
    context.sources[0].end();

    assert.equal(context.sources[0].stopped, true);
    assert.equal(player.playing, true);
  });

  test("rounds the time to tenths of a second and carries them into minutes", async() => {
    const context = new FakeAudioContext();
    context.decoded = fakeBuffer([new Float32Array(59_960)], 1_000);
    const { player } = await followingPlayer(context);
    player.play();
    context.currentTime = 30.04;

    assert.equal(player.readout().time, "0:30.0 / 1:00.0");
  });

  for (const { reason, content } of [
    {
      reason: "the document holds no bytes",
      content: null
    },
    {
      reason: "the decoded sound holds no samples",
      content: kOggBytes
    }
  ]) {
    test(`reports an empty sound that cannot play when ${reason}`, async() => {
      const context = new FakeAudioContext();
      context.decoded = fakeBuffer([new Float32Array(0)]);
      const player = new SoundPlayer(context.asAudioContext());
      const document = new SoundDocument();
      if (content !== null) {
        document.load(encodeContent(content));
      }
      await player.follow(document);
      player.play();

      assert.equal(player.playing, false);
      assert.deepEqual(player.readout(), {
        status: "empty",
        time: "0:00.0 / 0:00.0",
        format: null,
        playhead: null
      });
      assert.deepEqual(player.waveform(4, 2), []);
    });
  }

  test("reports a sound that the browser cannot decode", async() => {
    const context = new FakeAudioContext();
    context.decodeAudioData = () => Promise.reject(new DOMException("bad", "EncodingError"));
    const { player } = await followingPlayer(context);

    assert.deepEqual(player.readout(), {
      status: "undecodable",
      time: "0:00.0 / 0:00.0",
      format: null,
      playhead: null
    });
    assert.deepEqual(player.waveform(4, 2), []);
  });

  test("stops and reloads the sound when the document resets", async() => {
    const { context, document, player } = await followingPlayer();
    player.play();
    context.decoded = fakeBuffer(
      [new Float32Array(48_000), new Float32Array(48_000)],
      48_000
    );
    const reloaded = nextSound(player);
    document.load(encodeContent(kOtherOggBytes));
    await reloaded;

    assert.equal(player.playing, false);
    assert.equal(player.readout().format, "48 kHz · Stereo");
  });

  test("keeps the newest sound when a reset lands while an older one is decoding", async() => {
    const context = new FakeAudioContext();
    const decodes: Array<(buffer: AudioBuffer) => void> = [];
    context.decodeAudioData = () => new Promise((resolve) => {
      decodes.push(resolve);
    });
    const player = new SoundPlayer(context.asAudioContext());
    const document = new SoundDocument();
    document.load(encodeContent(kOggBytes));

    const followed = player.follow(document);
    const newest = nextSound(player);
    document.load(encodeContent(kOtherOggBytes));
    decodes[1](fakeBuffer([new Float32Array(4), new Float32Array(4)]));
    await newest;
    decodes[0](fakeBuffer([new Float32Array(4)]));
    await followed;

    assert.equal(player.readout().format, "44.1 kHz · Stereo");
  });

  test("draws each waveform column from the lowest to the highest sample of every channel", async() => {
    const context = new FakeAudioContext();
    context.decoded = fakeBuffer([
      new Float32Array([0.5, -0.25, 0, 0.75]),
      new Float32Array([-0.5, 0.25, -1, 0.5])
    ]);
    const { player } = await followingPlayer(context);

    assert.deepEqual(player.waveform(2, 4), [
      {
        top: 1,
        height: 2
      },
      {
        top: 0.5,
        height: 3.5
      }
    ]);
  });

  test("gives every waveform column a sample when columns outnumber samples", async() => {
    const context = new FakeAudioContext();
    context.decoded = fakeBuffer([new Float32Array([-0.5, 0.5])]);
    const { player } = await followingPlayer(context);

    assert.deepEqual(
      player.waveform(4, 2).map((bar) => bar.top),
      [1.5, 1.5, 0.5, 0.5]
    );
  });
});
