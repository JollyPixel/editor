// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { WorldAudio } from "../../core/systems/World.ts";
import { AudioMixer } from "./AudioMixer.ts";
import {
  mergeSoundSettings,
  variedPitch,
  type SoundSettings,
  type SoundSettingsInput
} from "../../core/systems/audio/SoundSettings.ts";
import { SoundVoices } from "../../core/systems/audio/SoundVoices.ts";
import type { Sound } from "./Sound.ts";
import {
  SoundInstance,
  type SoundAudio,
  type SoundStopOptions
} from "./SoundInstance.ts";

export interface GlobalAudioOptions {
  listener?: THREE.AudioListener;
  /**
   * Sounds heard at once; the oldest stops when a new one starts.
   * @default 32
   */
  maxVoices?: number;
}

export interface SoundPlayOptions extends SoundSettingsInput {
  /**
   * Seconds to wait before the sound starts.
   * @default 0
   */
  delay?: number;
  /**
   * Seconds over which the volume rises from 0.
   * @default 0
   */
  fadeIn?: number;
  /**
   * Multiplies the volume, the sound one or the given `volume`.
   * @default 1
   */
  gain?: number;
  /**
   * Starts once the page allows sound instead of being dropped, when asked
   * before the first user gesture.
   * @default the loop setting
   */
  queue?: boolean;
}

export interface SoundStopAllOptions extends SoundStopOptions {
  /**
   * Stops only the sounds of this mixer category.
   */
  category?: string;
}

// CONSTANTS
const kDefaultMaxVoices = 32;
const kUnlockEvents = ["pointerdown", "keydown", "touchend"] as const;

export class GlobalAudio implements WorldAudio {
  readonly mixer: AudioMixer;
  readonly voices: SoundVoices<SoundInstance>;

  #listener: THREE.AudioListener | null = null;
  #gesture = false;

  constructor(
    options: GlobalAudioOptions = {}
  ) {
    this.mixer = new AudioMixer(() => this.listener.getInput());
    this.voices = new SoundVoices(options.maxVoices ?? kDefaultMaxVoices);
    if (options.listener) {
      this.#adopt(options.listener);
    }
  }

  get listener(): THREE.AudioListener {
    return this.#listener ?? this.#adopt(new THREE.AudioListener());
  }

  get volume(): number {
    return this.mixer.master.volume;
  }

  set volume(
    value: number
  ) {
    this.mixer.master.volume = value;
  }

  get muted(): boolean {
    return this.mixer.master.muted;
  }

  set muted(
    value: boolean
  ) {
    this.mixer.master.muted = value;
  }

  get unlocked(): boolean {
    return this.#gesture || this.listener.context.state === "running";
  }

  play(
    sound: Sound,
    options: SoundPlayOptions = {}
  ): SoundInstance | null {
    return this.#start(
      sound,
      options,
      () => new THREE.Audio<GainNode>(this.listener)
    );
  }

  playAt(
    sound: Sound,
    position: THREE.Vector3Like,
    options: SoundPlayOptions = {}
  ): SoundInstance | null {
    return this.#start(sound, options, (settings) => {
      const audio = this.#positional(settings);
      const { panner } = audio;
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;

      return audio;
    });
  }

  attach(
    sound: Sound,
    object: THREE.Object3D,
    options: SoundPlayOptions = {}
  ): SoundInstance | null {
    return this.#start(sound, options, (settings) => {
      const audio = this.#positional(settings);
      object.add(audio);

      return audio;
    });
  }

  stopAll(
    options: SoundStopAllOptions = {}
  ): void {
    const { category, ...stop } = options;
    for (const voice of [...this.voices]) {
      if (category === undefined || voice.settings.category === category) {
        voice.stop(stop);
      }
    }
  }

  suspend(): Promise<void> {
    return this.listener.context.suspend();
  }

  resume(): Promise<void> {
    return this.listener.context.resume();
  }

  #start(
    sound: Sound,
    options: SoundPlayOptions,
    create: (settings: SoundSettings) => SoundAudio
  ): SoundInstance | null {
    const {
      delay = 0,
      fadeIn = 0,
      gain = 1,
      queue,
      ...overrides
    } = options;
    const settings = mergeSoundSettings(sound.settings, {
      ...overrides,
      volume: (overrides.volume ?? sound.settings.volume) * gain
    });
    const { context } = this.listener;
    if (!(queue ?? settings.loop) && !this.unlocked) {
      return null;
    }

    return this.voices.start(sound, settings, context.currentTime, () => {
      const audio = create(settings);
      const fader = context.createGain();
      audio.gain.disconnect();
      audio.gain.connect(fader);
      fader.connect(this.mixer.input(settings.category));
      audio.setBuffer(sound.buffer);
      audio.setLoop(settings.loop);
      audio.setLoopStart(settings.loopStart);
      audio.setLoopEnd(settings.loopEnd);
      audio.setVolume(settings.volume);
      audio.setPlaybackRate(variedPitch(settings));

      const instance = new SoundInstance({
        sound,
        settings,
        audio,
        fader
      });
      if (fadeIn > 0) {
        fader.gain.value = 0;
        instance.fade(1, fadeIn);
      }
      audio.play(delay);

      return instance;
    });
  }

  #positional(
    settings: SoundSettings
  ): THREE.PositionalAudio {
    const { spatial } = settings;

    return new THREE.PositionalAudio(this.listener)
      .setRefDistance(spatial.refDistance)
      .setMaxDistance(spatial.maxDistance)
      .setRolloffFactor(spatial.rolloffFactor)
      .setDistanceModel(spatial.distanceModel);
  }

  #adopt(
    listener: THREE.AudioListener
  ): THREE.AudioListener {
    this.#listener = listener;
    const { context } = listener;
    if (context.state !== "running" && typeof globalThis.addEventListener === "function") {
      const unlock = () => {
        this.#gesture = true;
        context.resume().catch(() => undefined);
        for (const type of kUnlockEvents) {
          globalThis.removeEventListener(type, unlock, true);
        }
      };
      for (const type of kUnlockEvents) {
        globalThis.addEventListener(type, unlock, true);
      }
    }

    return listener;
  }
}
