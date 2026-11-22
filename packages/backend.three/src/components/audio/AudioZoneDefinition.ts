// Import Third-party Dependencies
import {
  type Actor,
  type ActorComponent,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { SoundAssetType } from "../../assets/loaders/SoundAssetLoader.ts";
import type { Sound } from "../../audio/Sound.ts";
import {
  AUDIO_ZONE_DEFAULTS,
  AudioZoneComponent,
  type AudioZoneMode,
  type AudioZoneSettings
} from "./AudioZoneComponent.ts";
import { AudioZoneOutline } from "./AudioZoneOutline.ts";
import type { AudioZoneShapeKind } from "./AudioZoneShape.ts";

export type AudioZoneAssets = {
  sound: Sound;
};

export type SceneAudioZone = AudioZoneComponent<any> | AudioZoneOutline;

// CONSTANTS
const kZoneModes: Record<AudioZoneMode, true> = {
  ambient: true,
  trigger: true
};
const kZoneShapes: Record<AudioZoneShapeKind, true> = {
  box: true,
  sphere: true
};

export class AudioZoneDefinition implements Systems.ComponentDefinition<
  AudioZoneSettings,
  SceneAudioZone,
  AudioZoneAssets
> {
  readonly type = "AudioZone";
  readonly assets = {
    sound: SoundAssetType
  };

  parse(
    data: Readonly<Systems.JSONObject>
  ): AudioZoneSettings {
    const fields = new Systems.ComponentData(data);
    const defaults = AUDIO_ZONE_DEFAULTS;
    const size = fields.object("size");

    return {
      mode: fields.choice("mode", kZoneModes, defaults.mode),
      shape: fields.choice("shape", kZoneShapes, defaults.shape),
      size: {
        x: size?.number("x", defaults.size.x) ?? defaults.size.x,
        y: size?.number("y", defaults.size.y) ?? defaults.size.y,
        z: size?.number("z", defaults.size.z) ?? defaults.size.z
      },
      radius: fields.number("radius", defaults.radius),
      falloff: fields.number("falloff", defaults.falloff),
      target: fields.string("target", defaults.target),
      stopOnExit: fields.boolean("stopOnExit", defaults.stopOnExit),
      volume: fields.number("volume", defaults.volume),
      color: fields.color("color", defaults.color)
    };
  }

  create(
    actor: Actor<any>,
    data: AudioZoneSettings,
    context: Systems.ComponentContext<AudioZoneAssets>
  ): SceneAudioZone {
    return context.mode === "edit" ?
      actor.addComponentAndGet(AudioZoneOutline, data) :
      actor.addComponentAndGet(AudioZoneComponent, {
        ...data,
        sound: context.assets.resolve("sound")
      });
  }

  apply(
    component: SceneAudioZone,
    data: AudioZoneSettings
  ): void {
    component.configure(data);
  }

  owns(
    component: ActorComponent<any>
  ): component is SceneAudioZone {
    return component instanceof AudioZoneComponent ||
      component instanceof AudioZoneOutline;
  }

  capture(
    component: SceneAudioZone
  ): Systems.JSONObject {
    const { size, ...settings } = component.settings;

    return {
      ...settings,
      size: { ...size }
    };
  }
}
