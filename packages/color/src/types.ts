/**
 * Prevents typed `RGBA` and `RGBA8` assignment while allowing literals.
 */
declare const kChannelScale: unique symbol;

/**
 * Uses unit channels as the canonical format to avoid intermediate rounding.
 */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
  readonly [kChannelScale]?: "unit";
}

/**
 * Uses byte channels for `ImageData` and network storage.
 */
export interface RGBA8 {
  r: number;
  g: number;
  b: number;
  a: number;
  readonly [kChannelScale]?: "byte";
}

/**
 * Uses degrees for hue. Other channels use 0-1 and grays report zero hue.
 */
export interface HSVA {
  h: number;
  s: number;
  v: number;
  a: number;
}

/**
 * Uses degrees for hue. Other channels use 0-1 and grays report zero hue.
 */
export interface HSLA {
  h: number;
  s: number;
  l: number;
  a: number;
}

/**
 * Uses unit channels, with `w + b >= 1` representing gray with no hue.
 */
export interface HWBA {
  h: number;
  w: number;
  b: number;
  a: number;
}

export type ColorInput = string | RGBA;
