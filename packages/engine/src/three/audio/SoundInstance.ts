// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { SoundSettings } from "../../core/systems/audio/SoundSettings.ts";
import type { Sound } from "./Sound.ts";

export type SoundInstanceEvents = {
  ended: () => void;
};

export type SoundInstanceState = "playing" | "paused" | "stopped";

export type SoundAudio = THREE.Audio | THREE.PositionalAudio;

export interface SoundStopOptions {
  /**
   * Seconds over which the volume goes down to 0 before the sound stops.
   * @default 0
   */
  fade?: number;
}

export interface SoundInstanceOptions {
  sound: Sound;
  settings: Readonly<SoundSettings>;
  audio: SoundAudio;
  fader: GainNode;
}

export class SoundInstance extends Emitter<SoundInstanceEvents> {
  readonly sound: Sound;
  readonly settings: Readonly<SoundSettings>;
  readonly audio: SoundAudio;
  readonly startedAt: number;

  #fader: GainNode;
  #state: SoundInstanceState = "playing";
  #finished = false;

  constructor(
    options: SoundInstanceOptions
  ) {
    super();

    this.sound = options.sound;
    this.settings = options.settings;
    this.audio = options.audio;
    this.#fader = options.fader;
    this.startedAt = this.audio.context.currentTime;

    const { audio } = this;
    audio.onEnded = () => {
      THREE.Audio.prototype.onEnded.call(audio);
      this.#finish();
    };
  }

  get state(): SoundInstanceState {
    return this.#state;
  }

  get playing(): boolean {
    return this.#state === "playing";
  }

  get volume(): number {
    return this.audio.getVolume();
  }

  set volume(
    value: number
  ) {
    this.audio.setVolume(THREE.MathUtils.clamp(value, 0, 1));
  }

  get pitch(): number {
    return this.audio.getPlaybackRate();
  }

  set pitch(
    value: number
  ) {
    this.audio.setPlaybackRate(Math.max(value, 0.01));
  }

  pause(): void {
    if (this.#state === "playing") {
      this.audio.pause();
      this.#state = "paused";
    }
  }

  resume(): void {
    if (this.#state === "paused") {
      this.audio.play();
      this.#state = "playing";
    }
  }

  fade(
    volume: number,
    seconds: number
  ): void {
    if (this.#state === "stopped") {
      return;
    }

    const { gain } = this.#fader;
    const now = this.#fader.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(
      THREE.MathUtils.clamp(volume, 0, 1),
      now + Math.max(seconds, 0)
    );
  }

  stop(
    options: SoundStopOptions = {}
  ): void {
    const { fade = 0 } = options;
    if (this.#state === "stopped") {
      return;
    }
    if (fade <= 0 || this.#state === "paused") {
      this.audio.stop();
      this.#finish();

      return;
    }

    this.fade(0, fade);
    this.audio.stop(fade);
    this.#state = "stopped";
    const { source } = this.audio;
    if (source === null) {
      this.#finish();
    }
    else {
      source.addEventListener("ended", () => this.#finish(), { once: true });
    }
  }

  #finish(): void {
    if (this.#finished) {
      return;
    }

    this.#finished = true;
    this.#state = "stopped";
    this.audio.disconnect();
    this.audio.gain.disconnect();
    this.#fader.disconnect();
    this.audio.removeFromParent();
    this.emit("ended");
  }
}
