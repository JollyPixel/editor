// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type AudioBufferCache,
  type AudioBufferLoader,
  InMemoryAudioBufferCache,
  ThreeAudioBufferLoader
} from "./AudioBuffer.ts";
import type { AudioListenerAdapter } from "./AudioListener.ts";

export interface AudioFactory {
  createAudio(
    url: string
  ): Promise<THREE.Audio>;
  createPositionalAudio(
    url: string
  ): Promise<THREE.PositionalAudio>;
}

export interface AudioServiceOptions {
  listener?: AudioListenerAdapter;
  cache?: AudioBufferCache;
  loader?: AudioBufferLoader;
}

export class AudioService implements AudioFactory {
  #listener: AudioListenerAdapter;
  #cache: AudioBufferCache;
  #loader: AudioBufferLoader;

  constructor(
    options: AudioServiceOptions
  ) {
    const {
      listener = new THREE.AudioListener(),
      cache = new InMemoryAudioBufferCache(),
      loader = new ThreeAudioBufferLoader()
    } = options;

    this.#listener = listener;
    this.#cache = cache;
    this.#loader = loader;
  }

  async #loadAudioBuffer(
    url: string
  ): Promise<AudioBuffer> {
    if (this.#cache.has(url)) {
      return this.#cache.get(url)!;
    }

    const buffer = await this.#loader.load(url);
    this.#cache.set(url, buffer);

    return buffer;
  }

  async createAudio(
    url: string
  ): Promise<THREE.Audio> {
    const buffer = await this.#loadAudioBuffer(url);

    const audio = new THREE.Audio(
      this.#listener as unknown as THREE.AudioListener
    );
    audio.setBuffer(buffer);

    return audio;
  }

  async createPositionalAudio(
    url: string
  ): Promise<THREE.PositionalAudio> {
    const buffer = await this.#loadAudioBuffer(url);

    const audio = new THREE.PositionalAudio(
      this.#listener as unknown as THREE.AudioListener
    );
    audio.setBuffer(buffer!);

    return audio;
  }
}
