// Import Third-party Dependencies
import {
  HARMONY_KINDS,
  type HarmonyKind
} from "@jolly-pixel/color";

// Import Internal Dependencies
import type { ColorPickerChannels } from "./channels.ts";
import type { ColorPickerSpace } from "./space.ts";

// CONSTANTS
export const COLOR_PICKER_DEFAULTS: Readonly<ColorPickerPreferences> = Object.freeze({
  space: "hsv",
  selector: "square",
  channels: "hsl",
  harmony: "none",
  discrete: false
});

export const COLOR_PICKER_OPTIONS: ColorPickerOptions = {
  space: [
    {
      value: "hsv",
      label: "HSV"
    },
    {
      value: "okhsv",
      label: "OKHSV"
    }
  ],
  selector: [
    {
      value: "square",
      label: "Square"
    },
    {
      value: "wheel",
      label: "Wheel"
    }
  ],
  channels: [
    {
      value: "hsl",
      label: "HSL"
    },
    {
      value: "oklch",
      label: "OKLCH"
    }
  ],
  harmony: [
    {
      value: "none",
      label: "None"
    },
    ...HARMONY_KINDS.map((kind) => {
      return {
        value: kind,
        label: harmonyLabel(kind)
      };
    })
  ]
};

export type ColorPickerSelector = "square" | "wheel";
export type ColorPickerHarmony = HarmonyKind | "none";

export interface ColorPickerPreferences {
  space: ColorPickerSpace;
  selector: ColorPickerSelector;
  channels: ColorPickerChannels;
  harmony: ColorPickerHarmony;
  discrete: boolean;
}

export type ColorPickerChoice = Exclude<keyof ColorPickerPreferences, "discrete">;

export interface ColorPickerOption<TValue extends string> {
  value: TValue;
  label: string;
}

export type ColorPickerOptions = {
  readonly [TKey in ColorPickerChoice]: readonly ColorPickerOption<
    ColorPickerPreferences[TKey]
  >[];
};

export interface ColorPickerPreferenceSource {
  values(): Readonly<ColorPickerPreferences>;
  update(patch: Partial<ColorPickerPreferences>): void;
  watch(listener: () => void): () => void;
}

function harmonyLabel(
  kind: HarmonyKind
): string {
  const words = kind.replace("-", " ");

  return words.charAt(0).toUpperCase() + words.slice(1);
}
