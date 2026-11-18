// Import Third-party Dependencies
import type { AssetReference } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { GlobalAudio } from "./GlobalAudio.ts";
import { AudioPlaylists } from "./AudioPlaylists.ts";
import { Sound } from "./Sound.ts";
import { SoundChannel } from "./SoundChannel.ts";
import type { SoundInstance } from "./SoundInstance.ts";

export type AudioBackgroundSoundIndex = [playlistIndex: number, trackIndex: number];
export type AudioBackgroundSoundPath = `${string}.${string}`;

export interface SoundLoader {
  load(reference: AssetReference<Sound>): Promise<Sound>;
}

export interface AudioBackgroundOptions {
  audio: GlobalAudio;
  /**
   * Loads the tracks given as asset references, such as the world asset
   * coordinator.
   */
  assets?: SoundLoader;
  playlists: AudioBackgroundPlaylist[];
  autoPlay?: boolean | AudioBackgroundSoundPath | AudioBackgroundSoundIndex;
  /**
   * Seconds over which a track fades out while the next one fades in.
   * @default 0
   */
  crossfade?: number;
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
  sound: Sound | AssetReference<Sound>;
  /**
   * Replaces the volume of the sound settings.
   */
  volume?: number;
  metadata?: Record<string, any>;
}

// CONSTANTS
const kMusicCategory = "music";

export class AudioBackground {
  readonly playlists: AudioPlaylists;

  #audio: GlobalAudio;
  #assets: SoundLoader | null;
  #crossfade: number;
  #onError: (error: Error) => void;
  #channel = new SoundChannel(() => this.playNext().catch(this.#onError));
  #currentIndex: AudioBackgroundSoundIndex | null = null;
  #playRequest = 0;

  constructor(
    options: AudioBackgroundOptions
  ) {
    const {
      playlists,
      autoPlay = false,
      audio,
      assets = null,
      crossfade = 0,
      onError = (err) => console.error(err)
    } = options;

    this.playlists = new AudioPlaylists(playlists);
    this.#audio = audio;
    this.#assets = assets;
    this.#crossfade = Math.max(crossfade, 0);
    this.#onError = onError;
    if (autoPlay) {
      this.play(typeof autoPlay === "boolean" ? [0, 0] : autoPlay)
        .catch(this.#onError);
    }
  }

  get instance(): SoundInstance | null {
    return this.#channel.instance;
  }

  get isPlaying(): boolean {
    return this.#channel.playing;
  }

  get isPaused(): boolean {
    return this.#channel.instance?.state === "paused";
  }

  get track(): AudioBackgroundTrack | null {
    if (!this.#currentIndex) {
      return null;
    }

    return this.playlists.track(this.#currentIndex);
  }

  async play(
    pathOrIndex?: AudioBackgroundSoundPath | AudioBackgroundSoundIndex
  ): Promise<void> {
    if (typeof pathOrIndex === "undefined") {
      this.resume();

      return;
    }

    const index = this.playlists.resolve(pathOrIndex);
    const track = this.playlists.track(index);
    if (track === null) {
      throw new Error(`Track not found: ${pathOrIndex}`);
    }

    this.#fadeOut();
    this.#currentIndex = index;
    const request = ++this.#playRequest;

    const sound = await this.#load(track);
    if (request !== this.#playRequest) {
      return;
    }

    this.#channel.play(() => this.#audio.play(sound, {
      category: kMusicCategory,
      loop: false,
      queue: true,
      fadeIn: this.#crossfade,
      ...(track.volume === undefined ? {} : { volume: track.volume })
    }));
  }

  async playNext(): Promise<void> {
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

  stop(): void {
    this.#playRequest++;
    this.#fadeOut();
    this.#currentIndex = null;
  }

  pause(): void {
    this.#channel.pause();
  }

  resume(): void {
    this.#channel.resume();
  }

  #fadeOut(): void {
    this.#channel.stop({ fade: this.#crossfade });
  }

  #load(
    track: AudioBackgroundTrack
  ): Promise<Sound> {
    if (track.sound instanceof Sound) {
      return Promise.resolve(track.sound);
    }
    if (this.#assets === null) {
      return Promise.reject(
        new Error(`Track "${track.name}" needs the assets option to load.`)
      );
    }

    return this.#assets.load(track.sound);
  }
}
