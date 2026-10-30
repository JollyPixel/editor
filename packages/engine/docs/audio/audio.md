# Audio

The audio system is built on top of Three.js Audio and provides three layers:

- **GlobalAudio** — master volume control, shared `AudioListener`
- **GlobalAudioManager** — load, configure, and destroy `Audio` / `PositionalAudio` instances
- **AudioBackground** — playlist-based background music with auto-advance, loop, and chaining

`GlobalAudio` is created automatically by `World` and exposed
as `world.audio`. The manager and background player are built on top of it.

## 🔇 Browser autoplay policy

Browsers block audio until the user interacts with the page, so start
playback from a user gesture handler:

```ts
canvas.addEventListener("click", async() => {
  await audioBackground.play("ambient.forest");
});
```

## GlobalAudio

Master volume over a Three.js `AudioListener`; it emits `volumechange`.
Every sound created with the world listener follows the master volume.

The listener and its `AudioContext` are created on first use, so a world
that never plays sound opens no audio context.

```ts
type GlobalAudioEvents = {
  volumechange: [volume: number];
};
```

```ts
interface GlobalAudio {
  readonly listener: THREE.AudioListener;
  /** Same object as `listener`. */
  readonly threeAudioListener: THREE.AudioListener;

  /** Master volume, clamped to [0, 1]. */
  volume: number;
}
```

## GlobalAudioManager

Loads audio files, configures volume/loop, and manages cleanup.

```ts
interface AudioLoadingOptions {
  name?: string;
  // default false
  loop?: boolean;
  // default 1
  volume?: number;
}
```

```ts
interface AudioManager {
  // Async — fetch + decode from a URL at runtime
  loadAudio(url: string, options?: AudioLoadingOptions): Promise<THREE.Audio>;
  loadPositionalAudio(url: string, options?: AudioLoadingOptions): Promise<THREE.PositionalAudio>;

  // Sync — construct from a buffer already prepared by the runtime
  createAudio(buffer: AudioBuffer, options?: AudioLoadingOptions): THREE.Audio;
  createPositionalAudio(buffer: AudioBuffer, options?: AudioLoadingOptions): THREE.PositionalAudio;

  destroyAudio(audio: THREE.Audio | THREE.PositionalAudio): void;
}
```

### Construction

```ts
interface GlobalAudioManagerOptions {
  /** @default new THREE.AudioListener() */
  listener?: THREE.AudioListener;
  /** @default THREE.AudioLoader */
  loadBuffer?: (url: string) => Promise<AudioBuffer>;
}

GlobalAudioManager.fromWorld(world: World): GlobalAudioManager;
```

`fromWorld` binds the manager to the world's `AudioListener`, so the
world master volume applies to every sound it creates. A manager built
with its own listener is independent from `world.audio.volume`.
`volume` in `AudioLoadingOptions` is the per-sound gain.

The browser runtime registers `AudioAssetLoader` (exported with
`AUDIO_ASSET`) by default.

### Async loading (`loadAudio` / `loadPositionalAudio`)

Fetches and decodes a URL on demand. Each URL is decoded once per manager;
a failed load is retried on the next call.

```ts
const audio = await audioManager.loadAudio("sounds/click.mp3", { volume: 0.5 });
audio.play();
```

### Sync creation from pre-loaded buffers (`createAudio` / `createPositionalAudio`)

Builds a ready-to-play sound from a buffer the runtime already loaded, for
example through `AudioLibrary`, so lifecycle methods need no `await`.

```ts
// In Behavior.start():
this.#shootAudio = audioManager.createAudio(sfx.get("shoot"), { volume: 0.8 });
this.#musicAudio = audioManager.createAudio(sfx.get("music"), { loop: true, volume: 0.5 });
this.actor.add(this.#shootAudio);
```

For 3D sound, add a positional audio to an actor:

```ts
this.#footsteps = audioManager.createPositionalAudio(sfx.get("footstep"), { loop: true });
this.actor.add(this.#footsteps);
```

## See also

- [AudioBackground](audio-background.md)
- [AudioLibrary](audio-library.md)
