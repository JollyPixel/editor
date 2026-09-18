// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { World } from "../systems/index.ts";
import { loadAudioBuffer } from "../assets/audio.ts";

// CONSTANTS
const kDefaultVolume = 1;
const kDefaultLoop = false;

export type AudioManager = {
  loadAudio: (
    url: string,
    options?: AudioLoadingOptions
  ) => Promise<THREE.Audio>;
  loadPositionalAudio: (
    url: string,
    options?: AudioLoadingOptions
  ) => Promise<THREE.PositionalAudio>;
  createAudio: (
    buffer: AudioBuffer,
    options?: AudioLoadingOptions
  ) => THREE.Audio;
  createPositionalAudio: (
    buffer: AudioBuffer,
    options?: AudioLoadingOptions
  ) => THREE.PositionalAudio;
  destroyAudio: (
    audio: THREE.Audio | THREE.PositionalAudio
  ) => void;
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
  listener?: THREE.AudioListener;
  loadBuffer?: (url: string) => Promise<AudioBuffer>;
}

export class GlobalAudioManager implements AudioManager {
  #listener: THREE.AudioListener;
  #loadBuffer: (url: string) => Promise<AudioBuffer>;
  #buffers = new Map<string, Promise<AudioBuffer>>();

  static fromWorld(
    world: World<any, any>
  ): GlobalAudioManager {
    return new GlobalAudioManager({
      listener: world.audio.listener
    });
  }

  constructor(
    options: GlobalAudioManagerOptions = {}
  ) {
    const {
      listener = new THREE.AudioListener(),
      loadBuffer = (url) => loadAudioBuffer(url)
    } = options;

    this.#listener = listener;
    this.#loadBuffer = loadBuffer;
  }

  #bufferFor(
    url: string
  ): Promise<AudioBuffer> {
    let buffer = this.#buffers.get(url);
    if (!buffer) {
      buffer = this.#loadBuffer(url);
      buffer.catch(() => this.#buffers.delete(url));
      this.#buffers.set(url, buffer);
    }

    return buffer;
  }

  #configure<T extends THREE.Audio | THREE.PositionalAudio>(
    audio: T,
    buffer: AudioBuffer,
    options: AudioLoadingOptions
  ): T {
    const {
      name,
      loop = kDefaultLoop,
      volume = kDefaultVolume
    } = options;

    audio.setBuffer(buffer);
    audio.setLoop(loop);
    audio.setVolume(volume);
    if (name) {
      audio.name = name;
    }

    return audio;
  }

  async loadAudio(
    url: string,
    options: AudioLoadingOptions = {}
  ): Promise<THREE.Audio> {
    return this.createAudio(await this.#bufferFor(url), options);
  }

  async loadPositionalAudio(
    url: string,
    options: AudioLoadingOptions = {}
  ): Promise<THREE.PositionalAudio> {
    return this.createPositionalAudio(await this.#bufferFor(url), options);
  }

  createAudio(
    buffer: AudioBuffer,
    options: AudioLoadingOptions = {}
  ): THREE.Audio {
    return this.#configure(
      new THREE.Audio(this.#listener),
      buffer,
      options
    );
  }

  createPositionalAudio(
    buffer: AudioBuffer,
    options: AudioLoadingOptions = {}
  ): THREE.PositionalAudio {
    return this.#configure(
      new THREE.PositionalAudio(this.#listener),
      buffer,
      options
    );
  }

  destroyAudio(
    audio: THREE.Audio | THREE.PositionalAudio
  ) {
    if (audio.isPlaying) {
      audio.stop();
    }
    audio.disconnect();
    (audio as { buffer: AudioBuffer | null; }).buffer = null;
  }
}
