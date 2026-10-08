// Import Internal Dependencies
import type {
  GalleryOption,
  GalleryOptionValues
} from "../../types.ts";
import type { AxisStyle } from "../../../../src/math/types.ts";

export type AxisStyleOptionKey =
  | "axisLetters"
  | "letterOnly";

export const AXIS_STYLE_OPTIONS: readonly GalleryOption<AxisStyleOptionKey>[] = [
  {
    key: "axisLetters",
    label: "Axis letters"
  },
  {
    key: "letterOnly",
    label: "Letter only"
  }
];

export function axisStyleOf(
  options: GalleryOptionValues<AxisStyleOptionKey>
): AxisStyle {
  if (options.letterOnly) {
    return "letter";
  }

  return options.axisLetters ? "chip" : "corner";
}
