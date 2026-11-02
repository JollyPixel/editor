// Import Third-party Dependencies
import {
  definePreferences,
  type PreferenceValues
} from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { Volume } from "./player/volume/Volume.ts";

export const SOUND_PREFERENCES = definePreferences({
  name: "sound",
  label: "Sound",
  fields: {
    volume: {
      type: "range",
      label: "Volume",
      min: 0,
      max: 100,
      step: 1,
      default: Volume.default.toPercent()
    }
  }
});

export type SoundPreferences = PreferenceValues<
  typeof SOUND_PREFERENCES.fields
>;

export default [SOUND_PREFERENCES];
