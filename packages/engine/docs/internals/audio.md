# Audio Internals

Low-level audio services used internally by `GlobalAudioManager`.
These are not part of the public API but can be injected for testing
or custom implementations.

## AudioListener

Minimal interface wrapping Three.js `AudioListener` master volume.

```ts
type AudioListenerAdapter = {
  getMasterVolume: () => number;
  setMasterVolume: (value: number) => void;
};
```

## AudioBuffer

Buffer loading and caching layer.

```ts
interface AudioBufferLoader {
  load(url: string): Promise<AudioBuffer>;
}

interface AudioBufferCache {
  get(key: string): AudioBuffer | undefined;
  set(key: string, buffer: AudioBuffer): void;
  has(key: string): boolean;
  clear(): void;
}
```

Default implementations:

- `ThreeAudioBufferLoader` — uses `THREE.AudioLoader`
- `InMemoryAudioBufferCache` — in-memory `Map`-based cache

## AudioService

Factory that creates `THREE.Audio` and `THREE.PositionalAudio` instances
with automatic buffer caching.

```ts
interface AudioFactory {
  createAudio(url: string): Promise<THREE.Audio>;
  createPositionalAudio(url: string): Promise<THREE.PositionalAudio>;
}
```

```ts
interface AudioServiceOptions {
  listener?: AudioListenerAdapter;
  cache?: AudioBufferCache;
  loader?: AudioBufferLoader;
}

new AudioService(options: AudioServiceOptions);
```
