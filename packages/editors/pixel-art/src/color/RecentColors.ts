// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";

// CONSTANTS
const kRecentLimit = 8;

export class RecentColors {
  static readonly empty = new RecentColors([]);

  readonly colors: readonly ColorChangeDetail[];

  private constructor(
    colors: readonly ColorChangeDetail[]
  ) {
    this.colors = Object.freeze(colors);
  }

  with(
    color: ColorChangeDetail
  ): RecentColors {
    const [latest] = this.colors;
    if (latest?.hex === color.hex && latest.opacity === color.opacity) {
      return this;
    }

    const others = this.colors.filter((entry) => (
      entry.hex !== color.hex || entry.opacity !== color.opacity
    ));

    return new RecentColors([
      {
        hex: color.hex,
        opacity: color.opacity
      },
      ...others
    ].slice(0, kRecentLimit));
  }
}
