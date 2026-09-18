// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Emitter } from "@openally/emitt";

export type GlobalAudioEvents = {
  volumechange: (volume: number) => void;
};

export class GlobalAudio extends Emitter<GlobalAudioEvents> {
  listener: THREE.AudioListener;

  constructor(
    listener: THREE.AudioListener = new THREE.AudioListener()
  ) {
    super();

    this.listener = listener;
  }

  get threeAudioListener(): THREE.AudioListener {
    return this.listener;
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

    this.emit("volumechange", this.listener.getMasterVolume());
  }
}
