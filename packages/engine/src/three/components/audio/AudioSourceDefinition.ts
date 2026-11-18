// Import Internal Dependencies
import type { Actor } from "../../../core/actor/Actor.ts";
import type { Component } from "../../../core/components/types.ts";
import { ComponentData } from "../../../core/systems/scene/file/definitions/ComponentData.ts";
import type {
  ComponentContext,
  ComponentDefinition
} from "../../../core/systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../../core/systems/scene/file/SceneFile.ts";
import { SoundAssetType } from "../../assets/sound.ts";
import type { Sound } from "../../audio/Sound.ts";
import {
  AUDIO_SOURCE_DEFAULTS,
  AudioSourceComponent,
  type AudioSourceSettings
} from "./AudioSourceComponent.ts";

export type AudioSourceAssets = {
  sound: Sound;
};

export class AudioSourceDefinition implements ComponentDefinition<
  AudioSourceSettings,
  AudioSourceComponent<any>,
  AudioSourceAssets
> {
  readonly type = "AudioSource";
  readonly assets = {
    sound: SoundAssetType
  };

  parse(
    data: Readonly<JSONObject>
  ): AudioSourceSettings {
    const fields = new ComponentData(data);
    const defaults = AUDIO_SOURCE_DEFAULTS;

    return {
      spatial: fields.boolean("spatial", defaults.spatial),
      playOnStart: fields.boolean("playOnStart", defaults.playOnStart),
      volume: fields.number("volume", defaults.volume),
      color: fields.color("color", defaults.color)
    };
  }

  create(
    actor: Actor<any>,
    data: AudioSourceSettings,
    context: ComponentContext<AudioSourceAssets>
  ): AudioSourceComponent<any> {
    return actor.addComponentAndGet(AudioSourceComponent, {
      ...data,
      playOnStart: context.mode === "play" && data.playOnStart,
      sound: context.assets.resolve("sound")
    });
  }

  apply(
    component: AudioSourceComponent<any>,
    data: AudioSourceSettings
  ): void {
    component.configure(data);
  }

  owns(
    component: Component
  ): component is AudioSourceComponent<any> {
    return component instanceof AudioSourceComponent;
  }
}
