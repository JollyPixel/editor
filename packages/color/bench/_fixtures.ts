// Import Third-party Dependencies
import { mulberry32 } from "@jolly-pixel/bench";

// Import Internal Dependencies
import type {
  HSLA,
  HSVA,
  RGBA,
  RGBA8
} from "../src/types.ts";

// CONSTANTS
export const BATCH = 256;
const kNames = [
  "red",
  "cornflowerblue",
  "rebeccapurple",
  "darkslategrey",
  "papayawhip",
  "transparent"
];
const kRejected = [
  "#ff6",
  "#ff66",
  "#ff660",
  "rgb(25",
  "hsl(120, 50%",
  "notacolor",
  "#ggg",
  ""
];

export type Rng = () => number;

export function batchOf<T>(
  create: (rng: Rng) => T
): T[] {
  const rng = mulberry32();

  return Array.from({ length: BATCH }, () => create(rng));
}

export function byte(
  rng: Rng
): number {
  return Math.floor(rng() * 256);
}

export function hexPair(
  rng: Rng
): string {
  return byte(rng).toString(16).padStart(2, "0");
}

export function hexDigit(
  rng: Rng
): string {
  return Math.floor(rng() * 16).toString(16);
}

export function rgba8(
  rng: Rng
): RGBA8 {
  return {
    r: byte(rng),
    g: byte(rng),
    b: byte(rng),
    a: byte(rng)
  };
}

export function byteRgba(
  rng: Rng
): RGBA {
  return {
    r: byte(rng) / 255,
    g: byte(rng) / 255,
    b: byte(rng) / 255,
    a: byte(rng) / 255
  };
}

export function unitRgba(
  rng: Rng
): RGBA {
  return {
    r: rng(),
    g: rng(),
    b: rng(),
    a: rng()
  };
}

export function hsla(
  rng: Rng
): HSLA {
  return {
    h: rng() * 360,
    s: rng(),
    l: rng(),
    a: rng()
  };
}

export function hsva(
  rng: Rng
): HSVA {
  return {
    h: rng() * 360,
    s: rng(),
    v: rng(),
    a: rng()
  };
}

export function colorName(
  rng: Rng
): string {
  return kNames[Math.floor(rng() * kNames.length)];
}

export function rejectedInput(
  rng: Rng
): string {
  return kRejected[Math.floor(rng() * kRejected.length)];
}

export function imageBytes(
  size: number
): Uint8ClampedArray {
  const rng = mulberry32();
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i++) {
    data[i] = byte(rng);
  }

  return data;
}
