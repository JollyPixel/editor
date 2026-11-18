// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { SoundPlayOptions } from "../../audio/GlobalAudio.ts";
import type { SoundChannel } from "../../audio/SoundChannel.ts";
import type { SoundInstance } from "../../audio/SoundInstance.ts";
import type {
  AudioZoneMode,
  AudioZoneSettings
} from "./AudioZoneComponent.ts";

export interface AudioZoneTrack {
  readonly channel: SoundChannel;
  readonly settings: Readonly<AudioZoneSettings>;
  play(
    options?: SoundPlayOptions
  ): SoundInstance | null;
}

export interface AudioZonePlayback {
  cross?(
    track: AudioZoneTrack,
    inside: boolean
  ): void;
  follow?(
    track: AudioZoneTrack,
    distance: number
  ): void;
}

// CONSTANTS
const kExitFade = 0.25;

export const AUDIO_ZONE_PLAYBACKS: Readonly<Record<AudioZoneMode, AudioZonePlayback>> = {
  ambient: {
    follow({ channel, settings, play }, distance) {
      const gain = settings.falloff === 0 ?
        Number(distance === 0) :
        1 - THREE.MathUtils.clamp(distance / settings.falloff, 0, 1);
      if (gain === 0) {
        channel.stop();

        return;
      }

      const instance = channel.instance ?? play({ loop: true });
      if (instance !== null) {
        instance.volume = instance.settings.volume * gain;
      }
    }
  },
  trigger: {
    cross({ channel, settings, play }, inside) {
      if (inside) {
        play();
      }
      else if (settings.stopOnExit) {
        channel.stop({ fade: kExitFade });
      }
    }
  }
};
