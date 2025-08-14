// Import Third-party Dependencies
import * as THREE from "three";
import { EventEmitter } from "@posva/event-emitter";

export type GlobalAudioEvents = {
  volumechange: [volume: number];
};

export class GlobalAudio extends EventEmitter<GlobalAudioEvents> {
  readonly listener = new THREE.AudioListener();
  #volume = 1;

  get volume() {
    return this.#volume;
  }

  set volume(
    value: number
  ) {
    this.#volume = THREE.MathUtils.clamp(value, 0, 1);
    this.emit("volumechange", this.#volume);
  }
}
