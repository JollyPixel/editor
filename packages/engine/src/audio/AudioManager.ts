// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { GameInstance } from "../systems/GameInstance.js";
import {
  type AudioListenerAdapter
} from "./internals/AudioListener.js";
import {
  AudioService,
  type AudioFactory
} from "./internals/AudioService.js";

// CONSTANTS
const kDefaultVolume = 1;
const kDefaultLoop = false;

export type AudioManager = {
  loadAudio: (url: string, options?: AudioLoadingOptions) => Promise<THREE.Audio>;
  loadPositionalAudio: (url: string, options?: AudioLoadingOptions) => Promise<THREE.PositionalAudio>;
  destroyAudio: (audio: THREE.Audio | THREE.PositionalAudio) => void;
};

export interface AudioLoadingOptions {
  name?: string;
  /**
   * @default false
   */
  loop?: boolean;
  /**
   * @default 1
   */
  volume?: number;
}

export interface GlobalAudioManagerOptions {
  listener?: AudioListenerAdapter;
  audioService?: AudioFactory;
}

export class GlobalAudioManager implements AudioManager {
  #listener: AudioListenerAdapter;
  #audioService: AudioFactory;

  static fromGameInstance(
    gameInstance: GameInstance
  ): GlobalAudioManager {
    return new GlobalAudioManager({
      listener: gameInstance.audio.listener
    });
  }

  constructor(
    options: GlobalAudioManagerOptions = {}
  ) {
    const {
      listener = new THREE.AudioListener(),
      audioService = new AudioService({ listener })
    } = options;

    this.#listener = listener;
    this.#audioService = audioService;
  }

  #configureAudio(
    audio: THREE.Audio | THREE.PositionalAudio,
    options: AudioLoadingOptions
  ): void {
    const { name, loop = kDefaultLoop, volume = kDefaultVolume } = options;

    audio.setLoop(loop);
    audio.setVolume(volume * this.#listener.getMasterVolume());

    if (name) {
      audio.name = name;
    }
  }

  async loadAudio(
    url: string,
    options: AudioLoadingOptions = {}
  ): Promise<THREE.Audio> {
    const audio = await this.#audioService.createAudio(url);
    this.#configureAudio(audio, options);

    return audio;
  }

  async loadPositionalAudio(
    url: string,
    options: AudioLoadingOptions = {}
  ): Promise<THREE.PositionalAudio> {
    const audio = await this.#audioService.createPositionalAudio(url);
    this.#configureAudio(audio, options);

    return audio;
  }

  destroyAudio(
    audio: THREE.Audio | THREE.PositionalAudio
  ) {
    if (audio.isPlaying) {
      audio.stop();
    }
    audio.disconnect();
    audio.buffer = null;
  }
}
