// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { fromRGBA8 } from "../src/convert/bytes.ts";
import {
  formatHex,
  formatHex8,
  formatHsl,
  formatRgb,
  formatRgba
} from "../src/format.ts";
import {
  BATCH,
  batchOf,
  byteRgba,
  hsla,
  rgba8,
  unitRgba
} from "./_fixtures.ts";
import type {
  HSLA,
  RGBA,
  RGBA8
} from "../src/types.ts";

const suite = defineSuite("format", (bench) => {
  const bytes = batchOf(byteRgba);
  const units = batchOf(unitRgba);
  const bytes8 = batchOf(rgba8);
  const hslColors = batchOf(hsla);

  bench
    .add("formatHex", () => lengthOf(units, (color) => formatHex(color)))
    .add("formatHex alpha", () => lengthOf(units, (color) => formatHex(color, true)))
    .add("formatHex8", () => lengthOf(bytes8, (color) => formatHex8(color)))
    .add("formatRgb", () => lengthOf(units, formatRgb))
    .add("formatRgba byte alpha", () => lengthOf(bytes, formatRgba))
    .add("formatRgba unit alpha", () => lengthOf(units, formatRgba))
    .add("formatRgba(fromRGBA8)", () => lengthOf(
      bytes8,
      (color: RGBA8) => formatRgba(fromRGBA8(color))
    ))
    .add("formatHsl", () => lengthOf(hslColors, formatHsl));
}, { opsPerIteration: BATCH });

export default suite;

function lengthOf<T extends RGBA | RGBA8 | HSLA>(
  colors: T[],
  format: (color: T) => string
): number {
  let length = 0;
  for (const color of colors) {
    length += format(color).length;
  }

  return length;
}

if (import.meta.main) {
  await runSuites([suite]);
}
