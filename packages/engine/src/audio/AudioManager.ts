// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  AssetLoader,
  type World
} from "../systems/index.ts";
import {
  type AudioListenerAdapter
} from "./internals/AudioListener.ts";
import {
  AudioService,
  type AudioFactory
} from "./internals/AudioService.ts";

// CONSTANTS
const kDefaultVolume = 1;
const kDefaultLoop = false;

export const AudioAssetLoader = new AssetLoader<AudioBuffer>({
  type: "audio",
  extensions: [".mp3", ".ogg", ".wav", ".aac", ".flac"],
  load: async(asset, context) => {
    const loader = new THREE.AudioLoader(context.manager);

    return loader.loadAsync(asset.toString());
  }
});

export type AudioManager = {
  loadAudio: (url: string, options?: AudioLoadingOptions) => Promise<THREE.Audio>;
  loadPositionalAudio: (url: string, options?: AudioLoadingOptions) => Promise<THREE.PositionalAudio>;
  createAudio: (buffer: AudioBuffer, options?: AudioLoadingOptions) => THREE.Audio;
  createPositionalAudio: (buffer: AudioBuffer, options?: AudioLoadingOptions) => THREE.PositionalAudio;
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

  static fromWorld(
    world: World<any, any>
  ): GlobalAudioManager {
    const audioManager = new GlobalAudioManager({
      listener: world.audio.listener
    });

    world.assetManager.register(AudioAssetLoader);

    return audioManager;
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

  createAudio(
    buffer: AudioBuffer,
    options: AudioLoadingOptions = {}
  ): THREE.Audio {
    const audio = new THREE.Audio(this.#listener as THREE.AudioListener);
    audio.setBuffer(buffer);
    this.#configureAudio(audio, options);

    return audio;
  }

  createPositionalAudio(
    buffer: AudioBuffer,
    options: AudioLoadingOptions = {}
  ): THREE.PositionalAudio {
    const audio = new THREE.PositionalAudio(this.#listener as THREE.AudioListener);
    audio.setBuffer(buffer);
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
