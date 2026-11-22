// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";

export class Sound {
  readonly buffer: AudioBuffer;
  readonly settings: Readonly<Systems.SoundSettings>;

  constructor(
    buffer: AudioBuffer,
    settings: Systems.SoundSettingsInput = {}
  ) {
    this.buffer = buffer;
    this.settings = Systems.mergeSoundSettings(Systems.SOUND_SETTINGS_DEFAULTS, settings);
  }

  get duration(): number {
    return this.buffer.duration;
  }
}
