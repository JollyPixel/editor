// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type {
  AudioManager
} from "./AudioManager.ts";
import { AudioPlaylists } from "./AudioPlaylists.ts";

export type AudioBackgroundSoundIndex = [playlistIndex: number, trackIndex: number];
export type AudioBackgroundSoundPath = `${string}.${string}`;

export interface AudioBackgroundOptions {
  audioManager: AudioManager;

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
  path: string;
  /**
   * @default 1
   */
  volume?: number;
  metadata?: Record<string, any>;
}

export class AudioBackground {
  readonly playlists: AudioPlaylists;
  audio: null | THREE.Audio = null;

  #audioManager: AudioManager;
  #onError: (error: Error) => void;
  #currentIndex: AudioBackgroundSoundIndex | null = null;
  #playRequest = 0;

  constructor(
    options: AudioBackgroundOptions
  ) {
    const {
      playlists,
      autoPlay = false,
      audioManager,
      onError = (err) => console.error(err)
    } = options;

    this.playlists = new AudioPlaylists(playlists);
    this.#onError = onError;
    this.#audioManager = audioManager;
    if (autoPlay) {
      this.play(typeof autoPlay === "boolean" ? [0, 0] : autoPlay)
        .catch(this.#onError);
    }
  }

  get isPlaying() {
    return Boolean(this.audio?.isPlaying);
  }

  get isPaused() {
    return Boolean(this.audio && !this.audio.isPlaying);
  }

  get track(): AudioBackgroundTrack | null {
    if (!this.#currentIndex) {
      return null;
    }

    return this.playlists.track(this.#currentIndex);
  }

  async play(
    pathOrIndex?: AudioBackgroundSoundPath | AudioBackgroundSoundIndex
  ) {
    if (typeof pathOrIndex === "undefined") {
      this.resume();

      return;
    }

    const index = this.playlists.resolve(pathOrIndex);
    const track = this.playlists.track(index);
    if (track === null) {
      throw new Error(`Track not found: ${pathOrIndex}`);
    }

    this.stop();
    this.#currentIndex = index;
    const request = this.#playRequest;

    const audio = await this.#audioManager.loadAudio(track.path, {
      name: track.name,
      volume: track.volume
    });
    if (request !== this.#playRequest) {
      this.#audioManager.destroyAudio(audio);

      return;
    }

    this.audio = audio;
    this.audio.onEnded = () => this.playNext().catch(this.#onError);
    this.audio.play();
  }

  async playNext() {
    if (!this.#currentIndex) {
      return;
    }

    const next = this.playlists.next(this.#currentIndex);
    if (next === null) {
      this.stop();
    }
    else {
      await this.play(next);
    }
  }

  stop() {
    this.#playRequest++;
    if (this.audio) {
      this.#audioManager.destroyAudio(this.audio);
      this.audio = null;
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
