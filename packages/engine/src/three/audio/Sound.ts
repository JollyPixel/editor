// Import Internal Dependencies
import {
  mergeSoundSettings,
  SOUND_SETTINGS_DEFAULTS,
  type SoundSettings,
  type SoundSettingsInput
} from "../../core/systems/audio/SoundSettings.ts";

export class Sound {
  readonly buffer: AudioBuffer;
  readonly settings: Readonly<SoundSettings>;

  constructor(
    buffer: AudioBuffer,
    settings: SoundSettingsInput = {}
  ) {
    this.buffer = buffer;
    this.settings = mergeSoundSettings(SOUND_SETTINGS_DEFAULTS, settings);
  }

  get duration(): number {
    return this.buffer.duration;
  }
}
