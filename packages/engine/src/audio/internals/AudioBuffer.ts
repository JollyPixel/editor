// Import Third-party Dependencies
import * as THREE from "three";

export interface AudioBufferCache {
  get(key: string): AudioBuffer | undefined;
  set(key: string, buffer: AudioBuffer): void;
  has(key: string): boolean;
  clear(): void;
}

export class InMemoryAudioBufferCache implements AudioBufferCache {
  #cache = new Map<string, AudioBuffer>();

  get(key: string): AudioBuffer | undefined {
    return this.#cache.get(key);
  }

  set(key: string, buffer: AudioBuffer): void {
    this.#cache.set(key, buffer);
  }

  has(key: string): boolean {
    return this.#cache.has(key);
  }

  clear(): void {
    this.#cache.clear();
  }
}

export interface AudioBufferLoader {
  load(url: string): Promise<AudioBuffer>;
}

export class ThreeAudioBufferLoader implements AudioBufferLoader {
  #manager: THREE.LoadingManager | undefined;

  constructor(
    manager?: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  load(url: string): Promise<AudioBuffer> {
    const audioLoader = new THREE.AudioLoader(this.#manager);

    return audioLoader.loadAsync(
      url
    );
  }
}
