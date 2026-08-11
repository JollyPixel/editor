/**
 * RGB channels use 0-255; alpha uses 0-1.
 */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Hue uses degrees; saturation, value, and alpha use 0-1.
 */
export interface HSVA {
  h: number;
  s: number;
  v: number;
  a: number;
}
