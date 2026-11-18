# AudioBackground

Playlist-based background music player. Supports multiple playlists
with configurable end behavior (stop, loop, chain to another playlist).
Tracks play through the `music` category of `world.audio`, and start even
when asked for before the page allows sound.

```ts
const bg = new AudioBackground({
  audio: world.audio,
  assets: world.assetCoordinator,
  crossfade: 1.5,
  autoPlay: "ambient.forest",
  playlists: [
    {
      name: "ambient",
      onEnd: "loop",
      tracks: [
        { name: "forest", sound: new AssetReference("music/forest", SoundAssetType) },
        { name: "rain", sound: new AssetReference("music/rain", SoundAssetType), volume: 0.8 }
      ]
    },
    {
      name: "battle",
      onEnd: "play-next-playlist",
      nextPlaylistName: "ambient",
      tracks: [
        { name: "intro", sound: battleIntro },
        { name: "loop", sound: battleLoop }
      ]
    }
  ]
});


// Play by path ("playlistName.trackName")
await bg.play("ambient.forest");

// Play by index [playlistIndex, trackIndex]
await bg.play([1, 0]);

// Pause / resume
bg.pause();
await bg.play(); // resumes current track

// Skip to next track in the playlist
await bg.playNext();

// Stop playback and reset
bg.stop();
```

## Types

```ts
interface AudioBackgroundOptions {
  audio: GlobalAudio;
  // loads the tracks given as asset references, such as world.assetCoordinator
  assets?: SoundLoader;
  playlists: AudioBackgroundPlaylist[];
  autoPlay?: boolean | AudioBackgroundSoundPath | AudioBackgroundSoundIndex;
  // seconds over which a track fades out while the next fades in, default 0
  crossfade?: number;
  onError?: (error: Error) => void;
}

interface SoundLoader {
  load(reference: AssetReference<Sound>): Promise<Sound>;
}

// Reference a track by "playlistName.trackName"
type AudioBackgroundSoundPath = `${string}.${string}`;
// Or by [playlistIndex, trackIndex]
type AudioBackgroundSoundIndex = [playlistIndex: number, trackIndex: number];

interface AudioBackgroundPlaylist {
  name: string;
  tracks: AudioBackgroundTrack[];
  // default "stop"
  onEnd?: "loop" | "stop" | "play-next-playlist";
  // Used when onEnd is "play-next-playlist"
  nextPlaylistName?: string;
}

interface AudioBackgroundTrack {
  name: string;
  sound: Sound | AssetReference<Sound>;
  // replaces the volume of the sound settings
  volume?: number;
  metadata?: Record<string, any>;
}
```

## Properties & API

```ts
interface AudioBackground {
  readonly playlists: AudioPlaylists;
  readonly instance: SoundInstance | null;

  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  readonly track: AudioBackgroundTrack | null;

  play(pathOrIndex?: AudioBackgroundSoundPath | AudioBackgroundSoundIndex): Promise<void>;
  playNext(): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;

}

class AudioPlaylists implements Iterable<AudioBackgroundPlaylist> {
  // An unknown playlist or track name resolves to -1, which track() maps to null.
  resolve(
    pathOrIndex: AudioBackgroundSoundPath | AudioBackgroundSoundIndex
  ): AudioBackgroundSoundIndex;
  track(index: AudioBackgroundSoundIndex): AudioBackgroundTrack | null;
  // The track playNext() moves to, or null when playback stops.
  next(index: AudioBackgroundSoundIndex): AudioBackgroundSoundIndex | null;
}
```

`playlists` wraps the array given to the constructor without copying it,
so tracks pushed into that array later are found by `play()` and
`playNext()`.
