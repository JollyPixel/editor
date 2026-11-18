// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ActorComponent } from "../../../core/actor/ActorComponent.ts";
import type { Actor } from "../../../core/actor/Actor.ts";
import type { WorldDefaultContext } from "../../../core/systems/World.ts";
import type { SoundPlayOptions } from "../../audio/GlobalAudio.ts";
import type { Sound } from "../../audio/Sound.ts";
import { SoundChannel } from "../../audio/SoundChannel.ts";
import type {
  SoundInstance,
  SoundStopOptions
} from "../../audio/SoundInstance.ts";

export interface AudioSourceOptions {
  sound?: Sound | null;
  /**
   * Plays the sound from the actor position instead of everywhere at once.
   * @default true
   */
  spatial?: boolean;
  /**
   * Plays the sound when the component starts.
   * @default false
   */
  playOnStart?: boolean;
  /**
   * Multiplies the sound volume, in [0, 1].
   * @default 1
   */
  volume?: number;
  /**
   * Hex color editors draw the source with. Playback ignores it.
   * @default "#38bdf8"
   */
  color?: string;
}

export type AudioSourceSettings = Required<Omit<AudioSourceOptions, "sound">>;

// CONSTANTS
export const AUDIO_SOURCE_DEFAULTS = {
  spatial: true,
  playOnStart: false,
  volume: 1,
  color: "#38bdf8"
} as const satisfies AudioSourceSettings;

export class AudioSourceComponent<
  TContext = WorldDefaultContext
> extends ActorComponent<TContext> {
  sound: Sound | null;

  #settings: AudioSourceSettings;
  #channel = new SoundChannel();

  constructor(
    actor: Actor<TContext>,
    options: AudioSourceOptions = {}
  ) {
    super({
      actor,
      typeName: "AudioSource"
    });

    const { sound = null, ...settings } = options;
    this.sound = sound;
    this.#settings = {
      ...AUDIO_SOURCE_DEFAULTS
    };
    this.configure(settings);
    this.addTeardown(() => this.stop());
  }

  get settings(): Readonly<AudioSourceSettings> {
    return this.#settings;
  }

  get instance(): SoundInstance | null {
    return this.#channel.instance;
  }

  get playing(): boolean {
    return this.#channel.playing;
  }

  configure(
    options: Omit<AudioSourceOptions, "sound">
  ): this {
    const settings = {
      ...this.#settings,
      ...options
    };
    this.#settings = {
      ...settings,
      volume: THREE.MathUtils.clamp(settings.volume, 0, 1)
    };

    return this;
  }

  start(): void {
    if (this.#settings.playOnStart) {
      this.play();
    }
  }

  play(
    options: SoundPlayOptions = {}
  ): SoundInstance | null {
    const { sound } = this;
    if (sound === null) {
      return null;
    }

    const { audio } = this.actor.world;
    const object = this.actor.node.object3D;
    const played = {
      ...options,
      gain: (options.gain ?? 1) * this.#settings.volume
    };

    return this.#channel.play(() => (
      this.#settings.spatial ?
        audio.attach(sound, object, played) :
        audio.play(sound, played)
    ));
  }

  stop(
    options: SoundStopOptions = {}
  ): void {
    this.#channel.stop(options);
  }

  pause(): void {
    this.#channel.pause();
  }

  resume(): void {
    this.#channel.resume();
  }
}
