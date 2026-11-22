# Audio

`world.audio` is a `GlobalAudio` with the three.js backend. It plays
`Sound` assets through a mixer of categories, limits how many sounds play at
once, and fades sounds in and out. The scene components built on it are in
[Audio components](../components/audio.md), and a behavior gets a sound from
the scene through a `Sound` scene property of a `Behavior`.

```ts
const jump = await world.assetCoordinator.load(
  new AssetReference("sfx/jump", SoundAssetType)
);

world.audio.play(jump);
world.audio.playAt(jump, { x: 4, y: 0, z: 2 });
world.audio.attach(jump, actor.node.object3D, { volume: 0.5 });
world.audio.mixer.category("music").volume = 0.3;
```

## Browser autoplay policy

Browsers keep audio silent until the user interacts with the page. Until the
first pointer, key or touch event, `play()` drops sounds that do not loop and
returns `null`. Looping sounds, and plays given `queue: true`, start when the
page allows sound.

## Sound

The value a `sound` asset loads to: the decoded `AudioBuffer` and the default
settings saved in the asset. `SoundAssetType` (kind `sound`) is registered in
the default asset loaders.

```ts
class Sound {
  constructor(buffer: AudioBuffer, settings?: SoundSettingsInput);

  readonly buffer: AudioBuffer;
  readonly settings: Readonly<SoundSettings>;
  readonly duration: number;
}
```

`SoundSettings`, `OggHeader`, `SoundVoices` and their helpers live in the
`Systems` namespace of `@jolly-pixel/ecs`. Out-of-range values are clamped.

```ts
interface SoundSettings {
  // default "sfx"
  category: string;
  // in [0, 1], default 1
  volume: number;
  // default false
  loop: boolean;
  // seconds, default 0; loopEnd 0 loops up to the end
  loopStart: number;
  loopEnd: number;
  // playback rate in [0.01, 16], default 1
  pitch: number;
  // random share of the pitch on each play, in [0, 0.9], default 0
  pitchVariation: number;
  // seconds during which a new play of the same sound is refused, default 0
  cooldown: number;
  // plays heard at once, the oldest stops first; 0 means no limit
  maxInstances: number;
  spatial: {
    // defaults 1, 100, 1 and "inverse"
    refDistance: number;
    // only the "linear" model reads it
    maxDistance: number;
    rolloffFactor: number;
    distanceModel: "linear" | "inverse" | "exponential";
  };
}

Systems.mergeSoundSettings(base: SoundSettings, overrides: SoundSettingsInput): SoundSettings;
Systems.parseSoundSettings(data: JSONObject): SoundSettings;
Systems.readSoundSettings(header: OggHeader | null): SoundSettings;
Systems.writeSoundSettings(header: OggHeader, settings: SoundSettings): Uint8Array;

// random number in [-1, 1]
Systems.rollPitch(): number;
// pitch * (1 + roll * pitchVariation), roll defaults to a new rollPitch()
Systems.variedPitch(settings: SoundSettings, roll?: number): number;
```

`Systems.SOUND_SETTINGS_LIMITS` holds the pitch bounds, and
`Systems.SOUND_CATEGORIES` and `Systems.SOUND_DISTANCE_MODELS` list the
built-in categories and distance models.

A sound file keeps its settings as JSON in the `JOLLYPIXEL_SOUND` comment of
its Ogg header (`Systems.SOUND_SETTINGS_TAG`). `readSoundSettings` returns
the defaults when the header is `null` or the tag is missing or invalid.
`writeSoundSettings` returns the whole file with the tag replaced.

`Systems.OggHeader` reads the header packets of an Ogg Opus or Vorbis file.

```ts
class OggHeader {
  // null when the bytes do not start with a complete Opus or Vorbis header
  static parse(bytes: Uint8Array): OggHeader | null;

  readonly comments: readonly string[];

  // last value of the NAME=value comment, NAME compared case-insensitively
  comment(name: string): string | undefined;
  // the whole file with every NAME comment replaced by one NAME=value
  withComment(name: string, value: string): Uint8Array;
}
```

## GlobalAudio

```ts
interface GlobalAudioOptions {
  listener?: THREE.AudioListener;
  // default 32
  maxVoices?: number;
}

interface SoundPlayOptions extends SoundSettingsInput {
  // seconds, default 0
  delay?: number;
  // seconds over which the volume rises from 0, default 0
  fadeIn?: number;
  // multiplies the volume, the sound one or the given one, default 1
  gain?: number;
  // start once the page allows sound instead of being dropped
  // default: the loop setting
  queue?: boolean;
}

class GlobalAudio {
  constructor(options?: GlobalAudioOptions);

  readonly mixer: AudioMixer;
  readonly voices: Systems.SoundVoices<SoundInstance>;
  readonly listener: THREE.AudioListener;
  readonly unlocked: boolean;
  // master volume and mute
  volume: number;
  muted: boolean;

  play(sound: Sound, options?: SoundPlayOptions): SoundInstance | null;
  playAt(sound: Sound, position: Vector3Like, options?: SoundPlayOptions): SoundInstance | null;
  attach(sound: Sound, object: THREE.Object3D, options?: SoundPlayOptions): SoundInstance | null;
  stopAll(options?: { category?: string; fade?: number }): void;
  suspend(): Promise<void>;
  resume(): Promise<void>;
}
```

The play options override the sound settings for that play only. `playAt`
and `attach` play a positional sound with the spatial settings; an attached
sound follows the object and leaves it when it ends. A play returns `null`
when the sound is in its cooldown or dropped by the autoplay policy.

The listener and its `AudioContext` are created on first use, so a world that
never plays sound opens no audio context.

## AudioMixer

Each sound plays through its category, then through `master`. The built-in
categories are `Systems.SOUND_CATEGORIES` (`music`, `sfx`, `ui`, `ambient`
and `voice`); `category(name)` creates any other one.

```ts
class AudioMixer {
  readonly master: AudioCategory;

  category(name: string): AudioCategory;
  categories(): IterableIterator<AudioCategory>;
  toJSON(): AudioMixerState;
  restore(state: JSONObject): void;
}

class AudioCategory {
  readonly name: string;
  // clamped to [0, 1]
  volume: number;
  muted: boolean;
}
```

The mixer emits `change` with the category whose volume or mute changed.
`toJSON()` and `restore()` save and reload the settings of every category;
`restore()` skips malformed entries. Where the state is stored is up to the
game.

## SoundInstance

One play of a sound. It emits `ended` once, when the sound reaches its end or
stops.

```ts
class SoundInstance {
  readonly sound: Sound;
  // the settings this play uses
  readonly settings: Readonly<SoundSettings>;
  readonly audio: THREE.Audio | THREE.PositionalAudio;
  readonly state: "playing" | "paused" | "stopped";
  readonly playing: boolean;
  volume: number;
  pitch: number;

  pause(): void;
  resume(): void;
  fade(volume: number, seconds: number): void;
  stop(options?: { fade?: number }): void;
}
```

## SoundVoices

`Systems.SoundVoices` holds the voices playing now, oldest first. `start`
returns `null` without calling `create` during the sound's `cooldown`, and
`null` when `create` does. A start over the sound's `maxInstances`, or over
`limit`, stops the oldest voice with a short fade. `GlobalAudio.voices` holds
its `SoundInstance`s with `maxVoices` as the limit.

```ts
interface SoundVoice {
  stop(options: { fade: number }): void;
  once(event: "ended", listener: () => void): unknown;
}

class SoundVoices<TVoice extends SoundVoice> implements Iterable<TVoice> {
  // default Infinity, at least 1
  constructor(limit?: number);

  readonly limit: number;
  readonly size: number;

  start(
    sound: object,
    settings: SoundSettings,
    now: number,
    create: () => TVoice | null
  ): TVoice | null;
  stopAll(): void;
}
```

## See also

- [AudioBackground](audio-background.md)
- [AudioLibrary](audio-library.md)
- [Audio components](../components/audio.md)
