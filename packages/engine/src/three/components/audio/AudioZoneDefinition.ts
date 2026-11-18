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

export class AudioZoneDefinition implements ComponentDefinition<
  AudioZoneSettings,
  SceneAudioZone,
  AudioZoneAssets
> {
  readonly type = "AudioZone";
  readonly assets = {
    sound: SoundAssetType
  };

  parse(
    data: Readonly<JSONObject>
  ): AudioZoneSettings {
    const fields = new ComponentData(data);
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
    context: ComponentContext<AudioZoneAssets>
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
  ): boolean {
    if (component instanceof AudioZoneOutline) {
      component.draw(data);
    }
    else {
      component.configure(data);
    }

    return true;
  }

  owns(
    component: Component
  ): component is SceneAudioZone {
    return component instanceof AudioZoneComponent ||
      component instanceof AudioZoneOutline;
  }

  capture(
    component: SceneAudioZone
  ): JSONObject {
    const { size, ...settings } = component.settings;

    return {
      ...settings,
      size: { ...size }
    };
  }
}
