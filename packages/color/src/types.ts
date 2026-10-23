declare const kChannelScale: unique symbol;

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
  readonly [kChannelScale]?: "unit";
}

export interface RGBA8 {
  r: number;
  g: number;
  b: number;
  a: number;
  readonly [kChannelScale]?: "byte";
}

export interface HSVA {
  h: number;
  s: number;
  v: number;
  a: number;
}

export interface HSLA {
  h: number;
  s: number;
  l: number;
  a: number;
}

export interface HWBA {
  h: number;
  w: number;
  b: number;
  a: number;
}

export interface OKLCHA {
  l: number;
  c: number;
  h: number;
  a: number;
}

export interface OKHSVA {
  h: number;
  s: number;
  v: number;
  a: number;
}

export interface OKHSLA {
  h: number;
  s: number;
  l: number;
  a: number;
}

export type ColorInput = string | RGBA;

export type ColorInput8 = string | RGBA8;
