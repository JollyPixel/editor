// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  ActorComponent,
  type Actor,
  SignalEvent,
  type Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { SoundPlayOptions } from "../../audio/GlobalAudio.ts";
import type { Sound } from "../../audio/Sound.ts";
import { SoundChannel } from "../../audio/SoundChannel.ts";
import type { SoundInstance } from "../../audio/SoundInstance.ts";
import { mergeDefined } from "../../utils/mergeDefined.ts";
import { AUDIO_SOURCE_DEFAULTS } from "./AudioSourceComponent.ts";
import {
  AudioZoneShape,
  type AudioZoneShapeSettings
} from "./AudioZoneShape.ts";

export type AudioZoneMode = "ambient" | "trigger";

export interface AudioZoneSettings extends AudioZoneShapeSettings {
  /**
   * `"ambient"` loops the sound and fades it with the distance to the zone;
   * `"trigger"` plays it when the target enters the zone.
   * @default "ambient"
   */
  mode: AudioZoneMode;
  /**
   * World distance outside the zone over which an ambient sound fades out.
   * @default 2
   */
  falloff: number;
  /**
   * Name or path of the actor that enters the zone; `""` is the audio
   * listener.
   * @default ""
   */
  target: string;
  /**
   * Stops a trigger sound when the target leaves the zone.
   * @default true
   */
  stopOnExit: boolean;
  /**
   * Multiplies the sound volume, in [0, 1].
   * @default 1
   */
  volume: number;
  /**
   * Hex color of the outline editors draw. Playback ignores it.
   * @default "#38bdf8"
   */
  color: string;
}

export interface AudioZoneOptions extends Partial<AudioZoneSettings> {
  sound?: Sound | null;
}

interface ZoneTarget {
  readonly actor: Actor<any> | null;
  readonly position: THREE.Vector3;
}

// CONSTANTS
export const AUDIO_ZONE_DEFAULTS = Object.freeze({
  mode: "ambient",
  shape: "box",
  size: Object.freeze({ x: 4, y: 4, z: 4 }),
  radius: 2,
  falloff: 2,
  target: "",
  stopOnExit: true,
  volume: 1,
  color: AUDIO_SOURCE_DEFAULTS.color
} as const satisfies AudioZoneSettings);

const kTargetPosition = new THREE.Vector3();
const kWorldMatrix = new THREE.Matrix4();
const kExitFade = 0.25;

export class AudioZoneComponent<
  TContext = Systems.WorldDefaultContext
> extends ActorComponent<TContext> {
  readonly entered = new SignalEvent<[target: Actor<any> | null]>();
  readonly exited = new SignalEvent<[target: Actor<any> | null]>();

  sound: Sound | null;

  #settings: AudioZoneSettings;
  #shape: AudioZoneShape;
  #inside = false;
  #channel = new SoundChannel();

  constructor(
    actor: Actor<TContext>,
    options: AudioZoneOptions = {}
  ) {
    super({
      actor,
      typeName: "AudioZone"
    });

    const { sound = null, ...settings } = options;
    this.sound = sound;
    this.#settings = resolveSettings(AUDIO_ZONE_DEFAULTS, settings);
    this.#shape = new AudioZoneShape(this.#settings);
    this.addTeardown(() => {
      this.#channel.stop();
      this.entered.clear();
      this.exited.clear();
    });
  }

  get settings(): Readonly<AudioZoneSettings> {
    return this.#settings;
  }

  get shape(): AudioZoneShape {
    return this.#shape;
  }

  get inside(): boolean {
    return this.#inside;
  }

  get instance(): SoundInstance | null {
    return this.#channel.instance;
  }

  configure(
    options: Partial<AudioZoneSettings>
  ): this {
    this.#settings = resolveSettings(this.#settings, options);
    this.#shape = new AudioZoneShape(this.#settings);

    return this;
  }

  update(): void {
    const target = this.#target();
    const distance = target === null ?
      Number.POSITIVE_INFINITY :
      this.#distanceTo(target.position);
    const inside = distance === 0;
    const { mode } = this.#settings;

    if (inside !== this.#inside) {
      this.#inside = inside;
      (inside ? this.entered : this.exited).emit(target?.actor ?? null);
      if (mode === "trigger") {
        this.#cross(inside);
      }
    }
    if (mode === "ambient") {
      this.#follow(distance);
    }
  }

  #cross(
    inside: boolean
  ): void {
    if (inside) {
      this.#play();
    }
    else if (this.#settings.stopOnExit) {
      this.#channel.stop({ fade: kExitFade });
    }
  }

  #follow(
    distance: number
  ): void {
    const { falloff } = this.#settings;
    const gain = falloff === 0 ?
      Number(distance === 0) :
      1 - THREE.MathUtils.clamp(distance / falloff, 0, 1);
    if (gain === 0) {
      this.#channel.stop();

      return;
    }

    const instance = this.#channel.instance ?? this.#play({ loop: true });
    if (instance !== null) {
      instance.volume = instance.settings.volume * gain;
    }
  }

  #play(
    options: SoundPlayOptions = {}
  ): SoundInstance | null {
    const { sound } = this;

    return sound === null ?
      null :
      this.#channel.play(() => this.actor.world.audio.play(sound, {
        ...options,
        gain: this.#settings.volume
      }));
  }

  #target(): ZoneTarget | null {
    const { world } = this.actor;
    if (this.#settings.target === "") {
      const { listener } = world.audio;
      listener.updateWorldMatrix(true, false);

      return {
        actor: null,
        position: listener.getWorldPosition(kTargetPosition)
      };
    }

    const actor = world.sceneManager.actors.tree.findActor(this.#settings.target);
    if (actor === null) {
      return null;
    }

    return {
      actor,
      position: kTargetPosition.copy(actor.transform.global.position)
    };
  }

  #distanceTo(
    position: THREE.Vector3
  ): number {
    return this.#shape.distanceTo(
      position,
      kWorldMatrix.fromArray(this.actor.transform.global.matrix)
    );
  }
}

function resolveSettings(
  current: Readonly<AudioZoneSettings>,
  options: Partial<AudioZoneSettings>
): AudioZoneSettings {
  const settings = mergeDefined<AudioZoneSettings>(current, options);

  return {
    ...settings,
    falloff: Math.max(settings.falloff, 0),
    volume: THREE.MathUtils.clamp(settings.volume, 0, 1)
  };
}
