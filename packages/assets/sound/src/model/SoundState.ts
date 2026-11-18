// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine/core";

// Import Internal Dependencies
import type {
  SoundCommand,
  SoundSettings,
  SoundSettingsChange
} from "../network/types.ts";

export class SoundState {
  #source: Uint8Array = new Uint8Array();
  #header: Systems.OggHeader | null = null;
  #settings: SoundSettings = Systems.SOUND_SETTINGS_DEFAULTS;
  #bytes: Uint8Array | null = null;

  get bytes(): Uint8Array {
    this.#bytes ??= this.bytesWith(this.#settings);

    return this.#bytes;
  }

  get settings(): Readonly<SoundSettings> {
    return this.#settings;
  }

  get empty(): boolean {
    return this.#source.byteLength === 0;
  }

  get editable(): boolean {
    return this.#header !== null;
  }

  load(
    bytes: Uint8Array
  ): void {
    this.#source = bytes;
    this.#header = Systems.OggHeader.parse(bytes);
    this.#settings = Systems.readSoundSettings(this.#header);
    this.#bytes = bytes;
  }

  clear(): void {
    this.load(new Uint8Array());
  }

  applyCommand(
    command: SoundCommand
  ): void {
    this.#settings = Systems.mergeSoundSettings(this.#settings, command.set);
    this.#bytes = null;
  }

  bytesWith(
    settings: Readonly<SoundSettings>
  ): Uint8Array {
    return this.#header === null ?
      this.#source :
      Systems.writeSoundSettings(this.#header, settings);
  }

  current(
    change: SoundSettingsChange
  ): SoundSettingsChange {
    return Object.fromEntries(
      changedSettings(change).map((key) => [
        key,
        structuredClone(this.#settings[key])
      ])
    );
  }
}

export function changedSettings(
  change: SoundSettingsChange
): (keyof SoundSettings)[] {
  return Object.keys(change) as (keyof SoundSettings)[];
}
