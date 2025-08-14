// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { GameInstance } from "../systems/GameInstance.js";
import {
  destroyAudio
} from "./Audio.js";

export type AudioBackgroundSoundIndex = [playlistIndex: number, trackIndex: number];
export type AudioBackgroundSoundPath = `${string}.${string}`;

export interface AudioBackgroundOptions {
  playlists: AudioBackgroundPlaylist[];
  autoPlay?: boolean | AudioBackgroundSoundPath | AudioBackgroundSoundIndex;
  onError?: (error: Error) => void;
}

export interface AudioBackgroundPlaylist {
  name: string;
  tracks: AudioBackgroundTrack[];
  /**
   * @default "stop"
   */
  onEnd?: "loop" | "stop" | "play-next-playlist";
  /**
   * Ignored if `onEnd` is not equal to "play-next-playlist"
   */
  nextPlaylistName?: string;
}

export interface AudioBackgroundTrack {
  name: string;
  assetPath: string;
  /**
   * @default 1
   */
  volume?: number;
  metadata?: Record<string, any>;
}

export class AudioBackground {
  gameInstance: GameInstance;
  playlists: AudioBackgroundPlaylist[] = [];
  audio: null | THREE.Audio = null;

  #onError: (error: Error) => void;
  #buffers = new Map<string, AudioBuffer>();
  #currentIndex: AudioBackgroundSoundIndex | null = null;

  constructor(
    gameInstance: GameInstance,
    options: AudioBackgroundOptions
  ) {
    const {
      playlists,
      autoPlay = false,
      onError = (err) => console.error(err)
    } = options;

    this.gameInstance = gameInstance;
    this.gameInstance.audio.on("volumechange", this.#updateAudioVolume.bind(this));
    this.playlists = playlists;
    this.#onError = onError;
    if (autoPlay) {
      this.play(typeof autoPlay === "boolean" ? [0, 0] : autoPlay)
        .catch(this.#onError);
    }
  }

  async preload(): Promise<void> {
    await Promise.all(
      this.playlists.flatMap((playlist) => playlist.tracks.map((track) => this.#loadAudioBuffer(track)))
    );
  }

  #updateAudioVolume(
    globalVolume: number
  ) {
    if (!this.audio || this.#currentIndex === null) {
      return;
    }

    const track = this.#getTrackByIndex(this.#currentIndex);
    if (track) {
      this.audio.setVolume((track.volume ?? 1) * globalVolume);
    }
  }

  #getTrackIndexFromPath(
    path: AudioBackgroundSoundPath
  ): AudioBackgroundSoundIndex | null {
    const [playlistName, trackName] = path.split(".");

    const playlistIndex = this.playlists.findIndex((playlist) => playlist.name === playlistName);
    if (playlistIndex === -1) {
      return null;
    }

    const trackIndex = this.playlists[playlistIndex].tracks.findIndex((track) => track.name === trackName);
    if (trackIndex === -1) {
      return null;
    }

    return [playlistIndex, trackIndex];
  }

  #getTrackByIndex(
    index: AudioBackgroundSoundIndex
  ): AudioBackgroundTrack | null {
    const [playlistIndex, trackIndex] = index;

    return this.playlists[playlistIndex]?.tracks[trackIndex] ?? null;
  }

  #getTrackByPath(
    path: AudioBackgroundSoundPath
  ): AudioBackgroundTrack | null {
    const [playlistName, trackName] = path.split(".");

    const playlist = this.playlists.find((playlist) => playlist.name === playlistName);
    if (!playlist) {
      return null;
    }

    return playlist.tracks.find((track) => track.name === trackName) ?? null;
  }

  #getPlaylistByName(
    name: string
  ): AudioBackgroundPlaylist | null {
    const playlist = this.playlists.find(
      (playlist) => playlist.name === name
    ) ?? null;

    return playlist && playlist.tracks.length > 0 ? playlist : null;
  }

  async #loadAudioBuffer(
    track: AudioBackgroundTrack
  ): Promise<AudioBuffer> {
    if (this.#buffers.has(track.assetPath)) {
      return this.#buffers.get(track.assetPath)!;
    }

    const buffer = await this.gameInstance.loader.audio.loadAsync(
      track.assetPath
    );
    this.#buffers.set(track.assetPath, buffer);

    return buffer;
  }

  async #createAudioFromTrack(
    track: AudioBackgroundTrack
  ): Promise<THREE.Audio> {
    const buffer = await this.#loadAudioBuffer(track);

    const { name, volume = 1 } = track;
    const sound = new THREE.Audio(this.gameInstance.audio.listener);
    sound.setBuffer(buffer);
    sound.setLoop(false);
    sound.setVolume(volume * this.gameInstance.audio.volume);
    sound.name = name;

    return sound;
  }

  get isPlaying() {
    return this.audio && this.audio.isPlaying;
  }

  get isPaused() {
    return this.audio && !this.audio.isPlaying;
  }

  get track(): AudioBackgroundTrack | null {
    if (!this.#currentIndex) {
      return null;
    }

    return this.#getTrackByIndex(this.#currentIndex);
  }

  async play(
    pathOrIndex: AudioBackgroundSoundPath | AudioBackgroundSoundIndex | undefined
  ) {
    if (typeof pathOrIndex === "undefined") {
      this.resume();

      return;
    }

    const track = typeof pathOrIndex === "string"
      ? this.#getTrackByPath(pathOrIndex)
      : this.#getTrackByIndex(pathOrIndex);
    if (!track) {
      throw new Error(`Track not found: ${pathOrIndex}`);
    }

    this.#currentIndex = typeof pathOrIndex === "string"
      ? this.#getTrackIndexFromPath(pathOrIndex)
      : pathOrIndex;

    if (this.audio) {
      this.stop();
    }
    this.audio = await this.#createAudioFromTrack(track);
    this.audio.onEnded = () => this.playNext().catch(this.#onError);
    this.audio.play();
  }

  async playNext() {
    if (!this.#currentIndex) {
      return;
    }

    const [playlistIndex, trackIndex] = this.#currentIndex;

    const playlist = this.playlists[playlistIndex];
    if (!playlist) {
      return;
    }

    const isLastTrackInPlaylist = trackIndex === playlist.tracks.length - 1;
    if (!isLastTrackInPlaylist) {
      await this.play([playlistIndex, trackIndex + 1]);

      return;
    }

    const onEnd = playlist.onEnd ?? "stop";
    switch (onEnd) {
      case "stop": {
        this.stop();
        break;
      }
      case "loop": {
        await this.play([playlistIndex, 0]);
        break;
      }
      case "play-next-playlist": {
        const nextPlaylist = this.#getPlaylistByName(playlist.nextPlaylistName ?? "");

        if (nextPlaylist) {
          const nextPlaylistIndex = this.playlists.findIndex(
            (pl) => pl.name === nextPlaylist.name
          );

          await this.play([nextPlaylistIndex, 0]);
        }
        else {
          this.stop();
        }
        break;
      }

      default: {
        const exhaustiveCheck: never = onEnd;
        throw new Error(`Unhandled onEnd value: ${exhaustiveCheck}`);
      }
    }
  }

  stop() {
    if (this.audio) {
      destroyAudio(this.audio);
    }
    this.#currentIndex = null;
  }

  pause() {
    if (this.audio && this.audio.isPlaying) {
      this.audio.pause();
    }
  }

  resume() {
    if (this.audio && !this.audio.isPlaying) {
      this.audio.play();
    }
  }
}
