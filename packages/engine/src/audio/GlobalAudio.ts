// Import Third-party Dependencies
import * as THREE from "three";
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import { type AudioListenerAdapter } from "./internals/AudioListener.ts";

export type VolumeObserver = {
  onMasterVolumeChange: (volume: number) => void;
};

export type GlobalAudioEvents = {
  volumechange: [volume: number];
};

export class GlobalAudio extends EventEmitter<GlobalAudioEvents> {
  #volumeObservers: VolumeObserver[] = [];

  listener: AudioListenerAdapter;

  constructor(
    listenerAdapter?: AudioListenerAdapter
  ) {
    super();

    this.listener = listenerAdapter ?? new THREE.AudioListener();
  }

  get threeAudioListener() {
    return this.listener as unknown as THREE.AudioListener;
  }

  observe(
    observer: VolumeObserver
  ): this {
    if (!this.#volumeObservers.includes(observer)) {
      this.#volumeObservers.push(observer);
    }

    return this;
  }

  unobserve(
    observer: VolumeObserver
  ): this {
    const index = this.#volumeObservers.indexOf(observer);
    if (index !== -1) {
      this.#volumeObservers.splice(index, 1);
    }

    return this;
  }

  get volume() {
    return this.listener.getMasterVolume();
  }

  set volume(
    value: number
  ) {
    this.listener.setMasterVolume(
      THREE.MathUtils.clamp(value, 0, 1)
    );
    const newVolume = this.listener.getMasterVolume();
    for (const observer of this.#volumeObservers) {
      observer.onMasterVolumeChange(newVolume);
    }

    this.emit("volumechange", newVolume);
  }
}
