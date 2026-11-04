// Import Third-party Dependencies
import type {
  ColorSortKey,
  PaletteFormat
} from "@jolly-pixel/color";

export type PaletteAction =
  | { type: "add"; }
  | { type: "ramp"; }
  | { type: "sort"; key: ColorSortKey; }
  | { type: "reverse"; }
  | { type: "duplicate"; }
  | { type: "remove"; }
  | { type: "load"; }
  | { type: "save"; format: PaletteFormat; }
  | { type: "from-texture"; };

export interface PaletteDropDetail {
  from: number;
  to: number;
  copy: boolean;
}

export interface StripPickDetail {
  hex: string;
  opacity: number;
  add: boolean;
}
