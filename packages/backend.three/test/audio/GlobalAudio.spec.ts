// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { GlobalAudio } from "../../src/audio/GlobalAudio.ts";
import { Sound } from "../../src/audio/Sound.ts";
import type { SoundInstance } from "../../src/audio/SoundInstance.ts";
import {
  audibleGain,
  fakeAudioBuffer,
  installFakeAudioContext,
  type FakeAudioContext,
  type FakeBufferSource,
  type FakeGainNode,
  type FakePannerNode
} from "../helpers/audio/FakeAudioContext.ts";

function playingSource(
  instance: SoundInstance | null
): FakeBufferSource {
  assert.ok(instance);

  return instance.audio.source as unknown as FakeBufferSource;
}

function findFader(
  instance: SoundInstance | null
): FakeGainNode {
  assert.ok(instance);
  const gain = instance.audio.gain as unknown as FakeGainNode;

  return [...gain.connections][0] as FakeGainNode;
}

describe("Audio.GlobalAudio", () => {
  let context: FakeAudioContext;
  let audio: GlobalAudio;

  beforeEach(() => {
    context = installFakeAudioContext();
    audio = new GlobalAudio();
  });

  test("should open no audio context before a sound plays", (t) => {
    const createGain = t.mock.method(context, "createGain");

    const idle = new GlobalAudio();
    idle.volume = 0.5;
    idle.mixer.category("music").muted = true;

    assert.strictEqual(createGain.mock.callCount(), 0);
  });

  test("should route each sound through its category and the master volume", () => {
    const effect = audio.play(new Sound(fakeAudioBuffer()));
    const music = audio.play(new Sound(fakeAudioBuffer(), { category: "music" }));
    assert.ok(effect && music);

    audio.volume = 0.8;
    audio.mixer.category("sfx").volume = 0.5;
    assert.strictEqual(audibleGain(effect.audio.gain), 0.4);
    assert.strictEqual(audibleGain(music.audio.gain), 0.8);

    audio.mixer.category("sfx").muted = true;
    assert.strictEqual(audibleGain(effect.audio.gain), 0);
    assert.strictEqual(audibleGain(music.audio.gain), 0.8);
  });

  test("should play with the sound settings unless the play overrides them", () => {
    const sound = new Sound(fakeAudioBuffer(), {
      category: "ambient",
      volume: 0.5,
      loop: true,
      loopStart: 0.25
    });

    const instance = audio.play(sound, { volume: 0.25 });

    const source = playingSource(instance);
    assert.strictEqual(source.loop, true);
    assert.strictEqual(source.loopStart, 0.25);
    assert.strictEqual(instance?.volume, 0.25);
    assert.strictEqual(instance?.settings.category, "ambient");
  });

  test("should vary the pitch of each play within the sound variation", (t) => {
    const sound = new Sound(fakeAudioBuffer(), {
      pitch: 2,
      pitchVariation: 0.25
    });

    t.mock.method(Math, "random", () => 1);
    const highest = audio.play(sound);
    t.mock.method(Math, "random", () => 0);
    const lowest = audio.play(sound);

    assert.strictEqual(highest?.pitch, 2.5);
    assert.strictEqual(lowest?.pitch, 1.5);
  });

  test("should refuse a play during the sound cooldown", () => {
    const sound = new Sound(fakeAudioBuffer(), { cooldown: 1 });

    assert.ok(audio.play(sound));
    context.currentTime = 0.5;
    assert.strictEqual(audio.play(sound), null);
    context.currentTime = 1;
    assert.ok(audio.play(sound));
  });

  test("should stop the oldest play past the sound max instances", () => {
    const sound = new Sound(fakeAudioBuffer(), { maxInstances: 2 });

    const [first, second, third] = [
      audio.play(sound),
      audio.play(sound),
      audio.play(sound)
    ];

    assert.strictEqual(first?.state, "stopped");
    assert.strictEqual(second?.state, "playing");
    assert.strictEqual(third?.state, "playing");
    assert.deepStrictEqual([...audio.voices], [second, third]);
  });

  test("should stop the oldest sound past the voice limit", () => {
    const limited = new GlobalAudio({ maxVoices: 2 });

    const [first, second, third] = [
      limited.play(new Sound(fakeAudioBuffer())),
      limited.play(new Sound(fakeAudioBuffer())),
      limited.play(new Sound(fakeAudioBuffer()))
    ];

    assert.strictEqual(first?.state, "stopped");
    assert.deepStrictEqual([...limited.voices], [second, third]);
  });

  test("should drop one-shots until the page allows sound but start loops and queued plays", async() => {
    context.state = "suspended";
    const oneShot = new Sound(fakeAudioBuffer());

    assert.strictEqual(audio.play(oneShot), null);
    assert.ok(audio.play(new Sound(fakeAudioBuffer(), { loop: true })));
    assert.ok(audio.play(oneShot, { queue: true }));

    await audio.resume();
    assert.ok(audio.play(oneShot));
  });

  test("should fade a sound in", () => {
    const instance = audio.play(new Sound(fakeAudioBuffer()), { fadeIn: 2 });

    assert.deepStrictEqual(findFader(instance).gain.ramps, [{ value: 1, endTime: 2 }]);
  });

  test("should fade a sound out before it stops and end it once", () => {
    const instance = audio.play(new Sound(fakeAudioBuffer()));
    const source = playingSource(instance);
    let ended = 0;
    instance?.on("ended", () => ended++);
    const fader = findFader(instance);
    context.currentTime = 1;

    instance?.stop({ fade: 0.5 });

    assert.deepStrictEqual(fader.gain.ramps, [{ value: 0, endTime: 1.5 }]);
    assert.strictEqual(source.stoppedAt, 1.5);
    assert.strictEqual(ended, 0);

    source.end();
    instance?.stop();

    assert.strictEqual(ended, 1);
    assert.strictEqual(audio.voices.size, 0);
    assert.strictEqual(audibleGain(fader), 0);
  });

  test("should release a sound that reaches its end", () => {
    const instance = audio.play(new Sound(fakeAudioBuffer()));
    let ended = false;
    instance?.on("ended", () => {
      ended = true;
    });

    playingSource(instance).end();

    assert.strictEqual(ended, true);
    assert.strictEqual(instance?.state, "stopped");
    assert.strictEqual(audio.voices.size, 0);
  });

  test("should place a positional sound at a point with its spatial settings", () => {
    const sound = new Sound(fakeAudioBuffer(), {
      spatial: {
        refDistance: 2,
        maxDistance: 30,
        distanceModel: "linear"
      }
    });

    const instance = audio.playAt(sound, { x: 1, y: 2, z: 3 });

    assert.ok(instance?.audio instanceof THREE.PositionalAudio);
    const panner = instance.audio.panner as unknown as FakePannerNode;
    assert.deepStrictEqual(
      [panner.positionX.value, panner.positionY.value, panner.positionZ.value],
      [1, 2, 3]
    );
    assert.strictEqual(panner.refDistance, 2);
    assert.strictEqual(panner.maxDistance, 30);
    assert.strictEqual(panner.distanceModel, "linear");
  });

  test("should keep an attached sound on its object until it ends", () => {
    const object = new THREE.Object3D();

    const instance = audio.attach(new Sound(fakeAudioBuffer()), object);

    assert.strictEqual(instance?.audio.parent, object);
    playingSource(instance).end();
    assert.strictEqual(instance?.audio.parent, null);
  });

  test("should stop only the sounds of the given category", () => {
    const effect = audio.play(new Sound(fakeAudioBuffer()));
    const music = audio.play(new Sound(fakeAudioBuffer(), { category: "music" }));

    audio.stopAll({ category: "music" });

    assert.strictEqual(effect?.state, "playing");
    assert.strictEqual(music?.state, "stopped");
  });
});
