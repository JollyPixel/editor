// Import Internal Dependencies
import {
  clampUnit,
  wrapHue
} from "../math.ts";
import type { HSVA } from "../types.ts";

// CONSTANTS
const kShade = 0.5;
const kHueOffsets: Readonly<Record<Exclude<HarmonyKind, "monochromatic">, number[]>> = {
  complementary: [180],
  analogous: [-30, 30],
  "split-complementary": [150, 210],
  triadic: [120, 240],
  tetradic: [60, 180, 240],
  square: [90, 180, 270]
};

export const HARMONY_KINDS = [
  "complementary",
  "monochromatic",
  "analogous",
  "split-complementary",
  "triadic",
  "tetradic",
  "square"
] as const;

export type HarmonyKind = typeof HARMONY_KINDS[number];

export function colorHarmony<T extends HSVA>(
  color: T,
  kind: HarmonyKind
): T[] {
  if (kind === "monochromatic") {
    return [
      color,
      {
        ...color,
        v: clampUnit(color.v * kShade)
      },
      {
        ...color,
        s: clampUnit(color.s * kShade)
      }
    ];
  }

  return [
    color,
    ...kHueOffsets[kind].map((offset) => {
      return {
        ...color,
        h: wrapHue(color.h + offset)
      };
    })
  ];
}
