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
  createBatch,
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
  const bytes = createBatch(byteRgba);
  const units = createBatch(unitRgba);
  const bytes8 = createBatch(rgba8);
  const hslColors = createBatch(hsla);

  bench
    .add("formatHex", () => totalLength(units, (color) => formatHex(color)))
    .add("formatHex alpha", () => totalLength(units, (color) => formatHex(color, true)))
    .add("formatHex8", () => totalLength(bytes8, (color) => formatHex8(color)))
    .add("formatRgb", () => totalLength(units, formatRgb))
    .add("formatRgba byte alpha", () => totalLength(bytes, formatRgba))
    .add("formatRgba unit alpha", () => totalLength(units, formatRgba))
    .add("formatRgba(fromRGBA8)", () => totalLength(
      bytes8,
      (color: RGBA8) => formatRgba(fromRGBA8(color))
    ))
    .add("formatHsl", () => totalLength(hslColors, formatHsl));
}, { opsPerIteration: BATCH });

export default suite;

function totalLength<T extends RGBA | RGBA8 | HSLA>(
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
