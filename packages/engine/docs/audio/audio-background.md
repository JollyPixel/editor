## AudioBackground

Playlist-based background music player. Supports multiple playlists
with configurable end behavior (stop, loop, chain to another playlist).
Implements `VolumeObserver` to react to master volume changes.

```ts
const audioManager = GlobalAudioManager.fromGameInstance(gameInstance);

const bg = new AudioBackground({
  audioManager,
  autoPlay: "ambient.forest",
  playlists: [
    {
      name: "ambient",
      onEnd: "loop",
      tracks: [
        { name: "forest", path: "/audio/forest.mp3" },
        { name: "rain", path: "/audio/rain.mp3", volume: 0.8 }
      ]
    },
    {
      name: "battle",
      onEnd: "play-next-playlist",
      nextPlaylistName: "ambient",
      tracks: [
        { name: "intro", path: "/audio/battle-intro.mp3" },
        { name: "loop", path: "/audio/battle-loop.mp3" }
      ]
    }
  ]
});

gameInstance.audio.observe(bg);

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

### Types

```ts
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
  path: string;
  // default 1
  volume?: number;
  metadata?: Record<string, any>;
}
```

### Properties & API

```ts
interface AudioBackground {
  playlists: AudioBackgroundPlaylist[];
  audio: THREE.Audio | null;

  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  readonly track: AudioBackgroundTrack | null;

  play(pathOrIndex?: AudioBackgroundSoundPath | AudioBackgroundSoundIndex): Promise<void>;
  playNext(): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;

  // VolumeObserver
  onMasterVolumeChange(volume: number): void;
}
```
