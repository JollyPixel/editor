// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import {
  SOUND_PREFERENCES,
  type SoundPreferences
} from "../../preferences.ts";
import type { SoundPlayer } from "../SoundPlayer.ts";
import { Volume } from "./Volume.ts";

export class VolumePreference {
  #preferences: Preferences;

  constructor(
    preferences: Preferences
  ) {
    this.#preferences = preferences;
  }

  follow(
    player: SoundPlayer
  ): () => void {
    function apply(
      values: SoundPreferences
    ): void {
      player.volume = Volume.percent(values.volume);
    }

    apply(this.#preferences.values(SOUND_PREFERENCES));
    const unsubscribes = [
      this.#preferences.watch(SOUND_PREFERENCES, apply),
      player.subscribe("volume", () => this.#preferences.update(
        SOUND_PREFERENCES,
        {
          volume: player.volume.toPercent()
        }
      ))
    ];

    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }
}
