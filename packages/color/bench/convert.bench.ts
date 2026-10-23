// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  ColorSpace,
  fromRGBA8,
  hslToHsv,
  hsvToHsl,
  linearToSrgb,
  srgbToLinear,
  toRGBA8
} from "../src/convert/index.ts";
import {
  BATCH,
  createBatch,
  hsla,
  hsva,
  rgba8,
  unitRgba
} from "./_fixtures.ts";

// CONSTANTS
const {
  hsl,
  hsv,
  hwb,
  oklch,
  okhsv,
  okhsl
} = ColorSpace;

const suite = defineSuite("convert", (bench) => {
  const rgbColors = createBatch(unitRgba);
  const hslColors = createBatch(hsla);
  const hsvColors = createBatch(hsva);
  const hwbColors = rgbColors.map((color) => hwb.fromRgb(color));
  const bytes8 = createBatch(rgba8);
  const oklchColors = rgbColors.map((color) => oklch.fromRgb(color));
  const okhsvColors = rgbColors.map((color) => okhsv.fromRgb(color));
  const okhslColors = rgbColors.map((color) => okhsl.fromRgb(color));

  bench
    .add("hsl.fromRgb", () => sumBy(rgbColors, (color) => hsl.fromRgb(color).h))
    .add("hsl.toRgb", () => sumBy(hslColors, (color) => hsl.toRgb(color).r))
    .add("hsv.fromRgb", () => sumBy(rgbColors, (color) => hsv.fromRgb(color).h))
    .add("hsv.toRgb", () => sumBy(hsvColors, (color) => hsv.toRgb(color).r))
    .add("hwb.fromRgb", () => sumBy(rgbColors, (color) => hwb.fromRgb(color).h))
    .add("hwb.toRgb", () => sumBy(hwbColors, (color) => hwb.toRgb(color).r))
    .add("hslToHsv", () => sumBy(hslColors, (color) => hslToHsv(color).v))
    .add("hsvToHsl", () => sumBy(hsvColors, (color) => hsvToHsl(color).l))
    .add("toRGBA8", () => sumBy(rgbColors, (color) => toRGBA8(color).r))
    .add("fromRGBA8", () => sumBy(bytes8, (color) => fromRGBA8(color).r))
    .add("oklch.fromRgb", () => sumBy(rgbColors, (color) => oklch.fromRgb(color).h))
    .add("oklch.toRgb", () => sumBy(oklchColors, (color) => oklch.toRgb(color).r))
    .add("okhsv.fromRgb", () => sumBy(rgbColors, (color) => okhsv.fromRgb(color).h))
    .add("okhsv.toRgb", () => sumBy(okhsvColors, (color) => okhsv.toRgb(color).r))
    .add("okhsl.fromRgb", () => sumBy(rgbColors, (color) => okhsl.fromRgb(color).h))
    .add("okhsl.toRgb", () => sumBy(okhslColors, (color) => okhsl.toRgb(color).r))
    .add("srgbToLinear", () => sumBy(rgbColors, (color) => srgbToLinear(color.r)))
    .add("linearToSrgb", () => sumBy(rgbColors, (color) => linearToSrgb(color.r)));
}, { opsPerIteration: BATCH });

export default suite;

function sumBy<T>(
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
