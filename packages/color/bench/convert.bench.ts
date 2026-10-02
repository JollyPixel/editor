// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  fromRGBA8,
  hslToHsv,
  hslToRgb,
  hsvToHsl,
  hsvToRgb,
  hwbToRgb,
  linearToSrgb,
  rgbToHsl,
  rgbToHsv,
  rgbToHwb,
  srgbToLinear,
  toRGBA8
} from "../src/convert/index.ts";
import {
  BATCH,
  batchOf,
  hsla,
  hsva,
  rgba8,
  unitRgba
} from "./_fixtures.ts";

const suite = defineSuite("convert", (bench) => {
  const rgbColors = batchOf(unitRgba);
  const hslColors = batchOf(hsla);
  const hsvColors = batchOf(hsva);
  const hwbColors = rgbColors.map(rgbToHwb);
  const bytes8 = batchOf(rgba8);

  bench
    .add("rgbToHsl", () => sumOf(rgbColors, (color) => rgbToHsl(color).h))
    .add("hslToRgb", () => sumOf(hslColors, (color) => hslToRgb(color).r))
    .add("rgbToHsv", () => sumOf(rgbColors, (color) => rgbToHsv(color).h))
    .add("hsvToRgb", () => sumOf(hsvColors, (color) => hsvToRgb(color).r))
    .add("rgbToHwb", () => sumOf(rgbColors, (color) => rgbToHwb(color).h))
    .add("hwbToRgb", () => sumOf(hwbColors, (color) => hwbToRgb(color).r))
    .add("hslToHsv", () => sumOf(hslColors, (color) => hslToHsv(color).v))
    .add("hsvToHsl", () => sumOf(hsvColors, (color) => hsvToHsl(color).l))
    .add("toRGBA8", () => sumOf(rgbColors, (color) => toRGBA8(color).r))
    .add("fromRGBA8", () => sumOf(bytes8, (color) => fromRGBA8(color).r))
    .add("srgbToLinear", () => sumOf(rgbColors, (color) => srgbToLinear(color.r)))
    .add("linearToSrgb", () => sumOf(rgbColors, (color) => linearToSrgb(color.r)));
}, { opsPerIteration: BATCH });

export default suite;

function sumOf<T>(
  colors: T[],
  read: (color: T) => number
): number {
  let sum = 0;
  for (const color of colors) {
    sum += read(color);
  }

  return sum;
}

if (import.meta.main) {
  await runSuites([suite]);
}
