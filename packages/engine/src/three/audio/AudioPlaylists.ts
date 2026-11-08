// Import Internal Dependencies
import type {
  AudioBackgroundPlaylist,
  AudioBackgroundSoundIndex,
  AudioBackgroundSoundPath,
  AudioBackgroundTrack
} from "./AudioBackground.ts";

export class AudioPlaylists implements Iterable<AudioBackgroundPlaylist> {
  #playlists: AudioBackgroundPlaylist[];

  constructor(
    playlists: AudioBackgroundPlaylist[]
  ) {
    this.#playlists = playlists;
  }

  resolve(
    pathOrIndex: AudioBackgroundSoundPath | AudioBackgroundSoundIndex
  ): AudioBackgroundSoundIndex {
    if (typeof pathOrIndex !== "string") {
      return pathOrIndex;
    }

    const [playlistName, trackName] = pathOrIndex.split(".");
    const playlistIndex = this.#playlists.findIndex(
      (playlist) => playlist.name === playlistName
    );
    const trackIndex = this.#playlists[playlistIndex]?.tracks.findIndex(
      (track) => track.name === trackName
    ) ?? -1;

    return [playlistIndex, trackIndex];
  }

  track(
    index: AudioBackgroundSoundIndex
  ): AudioBackgroundTrack | null {
    const [playlistIndex, trackIndex] = index;

    return this.#playlists[playlistIndex]?.tracks[trackIndex] ?? null;
  }

  next(
    index: AudioBackgroundSoundIndex
  ): AudioBackgroundSoundIndex | null {
    const [playlistIndex, trackIndex] = index;
    const playlist = this.#playlists[playlistIndex];
    if (!playlist) {
      return null;
    }
    if (trackIndex < playlist.tracks.length - 1) {
      return [playlistIndex, trackIndex + 1];
    }

    switch (playlist.onEnd ?? "stop") {
      case "stop":
        return null;
      case "loop":
        return [playlistIndex, 0];
      case "play-next-playlist": {
        const nextIndex = this.#playlists.findIndex(
          (candidate) => candidate.name === playlist.nextPlaylistName &&
            candidate.tracks.length > 0
        );

        return nextIndex === -1 ? null : [nextIndex, 0];
      }
    }
  }

  [Symbol.iterator](): IterableIterator<AudioBackgroundPlaylist> {
    return this.#playlists.values();
  }
}
