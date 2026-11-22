// Import Third-party Dependencies
import {
  type Actor,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { SoundAssetType } from "../../assets/loaders/SoundAssetLoader.ts";
import type { Sound } from "../../audio/Sound.ts";
import { ConfigurableDefinition } from "../ConfigurableDefinition.ts";
import {
  AUDIO_SOURCE_DEFAULTS,
  AudioSourceComponent,
  type AudioSourceSettings
} from "./AudioSourceComponent.ts";

export type AudioSourceAssets = {
  sound: Sound;
};

export class AudioSourceDefinition extends ConfigurableDefinition<
  AudioSourceSettings,
  AudioSourceComponent<any>,
  AudioSourceAssets
> {
  readonly type = "AudioSource";
  protected readonly component = AudioSourceComponent;
  readonly assets = {
    sound: SoundAssetType
  };

  parse(
    data: Readonly<Systems.JSONObject>
  ): AudioSourceSettings {
    const fields = new Systems.ComponentData(data);
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
    context: Systems.ComponentContext<AudioSourceAssets>
  ): AudioSourceComponent<any> {
    return actor.addComponentAndGet(AudioSourceComponent, {
      ...data,
      playOnStart: context.mode === "play" && data.playOnStart,
      sound: context.assets.resolve("sound")
    });
  }
}
