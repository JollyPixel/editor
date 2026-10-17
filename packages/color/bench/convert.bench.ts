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
  createBatch,
  hsla,
  hsva,
  rgba8,
  unitRgba
} from "./_fixtures.ts";

const suite = defineSuite("convert", (bench) => {
  const rgbColors = createBatch(unitRgba);
  const hslColors = createBatch(hsla);
  const hsvColors = createBatch(hsva);
  const hwbColors = rgbColors.map(rgbToHwb);
  const bytes8 = createBatch(rgba8);

  bench
    .add("rgbToHsl", () => sumBy(rgbColors, (color) => rgbToHsl(color).h))
    .add("hslToRgb", () => sumBy(hslColors, (color) => hslToRgb(color).r))
    .add("rgbToHsv", () => sumBy(rgbColors, (color) => rgbToHsv(color).h))
    .add("hsvToRgb", () => sumBy(hsvColors, (color) => hsvToRgb(color).r))
    .add("rgbToHwb", () => sumBy(rgbColors, (color) => rgbToHwb(color).h))
    .add("hwbToRgb", () => sumBy(hwbColors, (color) => hwbToRgb(color).r))
    .add("hslToHsv", () => sumBy(hslColors, (color) => hslToHsv(color).v))
    .add("hsvToHsl", () => sumBy(hsvColors, (color) => hsvToHsl(color).l))
    .add("toRGBA8", () => sumBy(rgbColors, (color) => toRGBA8(color).r))
    .add("fromRGBA8", () => sumBy(bytes8, (color) => fromRGBA8(color).r))
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
