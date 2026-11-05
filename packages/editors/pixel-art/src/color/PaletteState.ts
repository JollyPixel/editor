// Import Third-party Dependencies
import {
  Color,
  Gradient,
  sortColors,
  type ColorSortKey,
  type MixOptions
} from "@jolly-pixel/color";
import {
  COLOR_PALETTE_MAX_SIZE,
  ColorPalette,
  type RGBA8
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PaletteSelection } from "./PaletteSelection.ts";
import type { PixelArtPreferences } from "../preferences.ts";

// CONSTANTS
const kRampOptions: Record<PaletteRampSpace, MixOptions> = {
  oklab: { space: "oklab" },
  oklch: { space: "oklch" },
  "oklch-longer": { space: "oklch", hue: "longer" },
  linear: { space: "linear" },
  srgb: { space: "srgb" }
};
const kMinRampCount = 3;

export type PaletteRampSpace = PixelArtPreferences["rampSpace"];

export type PaletteScope = "selection" | "palette";

export type PaletteEdit =
  | { type: "add"; color: RGBA8; }
  | { type: "ramp"; space: PaletteRampSpace; }
  | { type: "sort"; key: ColorSortKey; }
  | { type: "reverse"; }
  | { type: "duplicate"; }
  | { type: "remove"; }
  | { type: "drop"; from: number; to: number; copy: boolean; }
  | { type: "replace"; colors: readonly RGBA8[]; };

export class PaletteState {
  readonly palette: ColorPalette;
  readonly selection: PaletteSelection | null;

  constructor(
    palette: ColorPalette,
    selection: PaletteSelection | null
  ) {
    this.palette = palette;
    this.selection = selection?.clampTo(palette.size) ?? null;
  }

  get scope(): PaletteScope {
    return this.selection?.multiple ? "selection" : "palette";
  }

  allows(
    type: PaletteEdit["type"]
  ): boolean {
    const { size } = this.palette;
    const count = this.selection?.count ?? 0;

    switch (type) {
      case "add":
        return size < COLOR_PALETTE_MAX_SIZE;
      case "ramp":
        return count >= kMinRampCount;
      case "duplicate":
        return count > 0 && size + count <= COLOR_PALETTE_MAX_SIZE;
      case "remove":
        return count > 0 && count < size;
      default:
        return true;
    }
  }

  apply(
    edit: PaletteEdit
  ): PaletteState {
    if (!this.allows(edit.type)) {
      return this;
    }

    const { palette } = this;
    const run = this.selection ?? this.#whole();
    switch (edit.type) {
      case "add": {
        const index = (this.selection?.focus ?? palette.size - 1) + 1;

        return this.#next(
          palette.withInserted(index, [edit.color]),
          PaletteSelection.at(index)
        );
      }
      case "ramp": {
        const ramp = Gradient.between(
          Color.fromBytes(palette.colorAt(run.start)),
          Color.fromBytes(palette.colorAt(run.end)),
          kRampOptions[edit.space]
        ).steps(run.count);

        return this.#next(
          palette.withColors(run.start, ramp.map((color) => color.toBytes())),
          this.selection
        );
      }
      case "sort": {
        const target = this.#target();
        const sorted = sortColors(
          this.#colors(target).map((color) => Color.fromBytes(color)),
          edit.key
        );

        return this.#next(
          palette.withColors(target.start, sorted.map((color) => color.toBytes())),
          this.selection
        );
      }
      case "reverse": {
        const target = this.#target();

        return this.#next(
          palette.withColors(target.start, this.#colors(target).reverse()),
          this.selection
        );
      }
      case "duplicate":
        return this.#copy(run, run.end + 1);
      case "remove": {
        const next = palette.withRemoved(run.start, run.count);

        return this.#next(
          next,
          PaletteSelection.at(Math.min(run.start, next.size - 1))
        );
      }
      case "drop": {
        const dragged = this.selection?.includes(edit.from) ?
          this.selection :
          PaletteSelection.at(edit.from);

        return edit.copy ?
          this.#copy(dragged, edit.to) :
          this.#move(dragged, edit.to);
      }
      case "replace":
        return edit.colors.length === 0 ?
          this :
          this.#next(
            ColorPalette.from(edit.colors.slice(0, COLOR_PALETTE_MAX_SIZE)),
            null
          );
      default:
        return this;
    }
  }

  #copy(
    run: PaletteSelection,
    to: number
  ): PaletteState {
    if (this.palette.size + run.count > COLOR_PALETTE_MAX_SIZE) {
      return this;
    }

    return this.#next(
      this.palette.withInserted(to, this.#colors(run)),
      PaletteSelection.spanning(to, run.count)
    );
  }

  #move(
    run: PaletteSelection,
    to: number
  ): PaletteState {
    const start = Math.min(to, this.palette.size - run.count);

    return this.#next(
      this.palette.withMoved(run.start, run.count, start),
      PaletteSelection.spanning(start, run.count)
    );
  }

  #target(): PaletteSelection {
    return this.scope === "selection" && this.selection !== null ?
      this.selection :
      this.#whole();
  }

  #whole(): PaletteSelection {
    return PaletteSelection.spanning(0, this.palette.size);
  }

  #colors(
    run: PaletteSelection
  ): RGBA8[] {
    return this.palette.toJSON().slice(run.start, run.end + 1);
  }

  #next(
    palette: ColorPalette,
    selection: PaletteSelection | null
  ): PaletteState {
    return palette === this.palette ?
      this :
      new PaletteState(palette, selection);
  }
}
