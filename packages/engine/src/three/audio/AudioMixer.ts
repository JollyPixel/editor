// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { SOUND_CATEGORIES } from "../../core/systems/audio/SoundSettings.ts";
import { ComponentData } from "../../core/systems/scene/file/definitions/ComponentData.ts";
import type { JSONObject } from "../../core/systems/scene/file/SceneFile.ts";

// CONSTANTS
export const MASTER_CATEGORY = "master";

const kGainSmoothing = 0.015;

export interface AudioCategoryState {
  volume: number;
  muted: boolean;
}

export type AudioMixerState = Record<string, AudioCategoryState>;

export type AudioMixerEvents = {
  change: (category: AudioCategory) => void;
};

export class AudioCategory {
  readonly name: string;

  #volume = 1;
  #muted = false;
  #node: GainNode | null = null;
  #changed: (category: AudioCategory) => void;

  constructor(
    name: string,
    changed: (category: AudioCategory) => void
  ) {
    this.name = name;
    this.#changed = changed;
  }

  get volume(): number {
    return this.#volume;
  }

  set volume(
    value: number
  ) {
    const volume = THREE.MathUtils.clamp(value, 0, 1);
    if (volume !== this.#volume) {
      this.#volume = volume;
      this.#write();
    }
  }

  get muted(): boolean {
    return this.#muted;
  }

  set muted(
    value: boolean
  ) {
    if (value !== this.#muted) {
      this.#muted = value;
      this.#write();
    }
  }

  get gain(): number {
    return this.#muted ? 0 : this.#volume;
  }

  input(
    create: () => GainNode
  ): GainNode {
    if (this.#node === null) {
      this.#node = create();
      this.#node.gain.value = this.gain;
    }

    return this.#node;
  }

  toJSON(): AudioCategoryState {
    return {
      volume: this.#volume,
      muted: this.#muted
    };
  }

  #write(): void {
    this.#node?.gain.setTargetAtTime(
      this.gain,
      this.#node.context.currentTime,
      kGainSmoothing
    );
    this.#changed(this);
  }
}

export class AudioMixer extends Emitter<AudioMixerEvents> {
  readonly master: AudioCategory;

  #categories = new Map<string, AudioCategory>();
  #output: () => GainNode;

  constructor(
    output: () => GainNode
  ) {
    super();

    this.#output = output;
    this.master = this.#create(MASTER_CATEGORY);
    for (const name of SOUND_CATEGORIES) {
      this.#create(name);
    }
  }

  category(
    name: string
  ): AudioCategory {
    return this.#categories.get(name) ?? this.#create(name);
  }

  categories(): IterableIterator<AudioCategory> {
    return this.#categories.values();
  }

  input(
    name: string
  ): GainNode {
    const master = this.master.input(this.#output);
    const category = this.category(name);

    return category === this.master ?
      master :
      category.input(() => {
        const node = master.context.createGain();
        node.connect(master);

        return node;
      });
  }

  toJSON(): AudioMixerState {
    return Object.fromEntries(
      [...this.#categories].map(([name, category]) => [name, category.toJSON()])
    );
  }

  restore(
    state: Readonly<JSONObject>
  ): void {
    const fields = new ComponentData(state);
    for (const name of Object.keys(state)) {
      const entry = fields.object(name);
      if (entry === null) {
        continue;
      }

      const category = this.category(name);
      category.volume = entry.number("volume", category.volume);
      category.muted = entry.boolean("muted", category.muted);
    }
  }

  #create(
    name: string
  ): AudioCategory {
    const category = new AudioCategory(
      name,
      (changed) => this.emit("change", changed)
    );
    this.#categories.set(name, category);

    return category;
  }
}
