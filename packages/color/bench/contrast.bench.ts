// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  contrastingColor,
  contrastRatio,
  relativeLuminance
} from "../src/contrast.ts";
import { formatHex } from "../src/format.ts";
import {
  BATCH,
  batchOf,
  unitRgba
} from "./_fixtures.ts";

const suite = defineSuite("contrast", (bench) => {
  const colors = batchOf(unitRgba);
  const hexColors = colors.map((color) => formatHex(color));

  bench
    .add("relativeLuminance", () => {
      let sum = 0;
      for (const color of colors) {
        sum += relativeLuminance(color);
      }

      return sum;
    })
    .add("contrastRatio", () => {
      let sum = 0;
      for (let i = 1; i < colors.length; i++) {
        sum += contrastRatio(colors[i - 1], colors[i]);
      }

      return sum;
    })
    .add("contrastingColor RGBA", () => {
      let length = 0;
      for (const color of colors) {
        length += contrastingColor(color).length;
      }

      return length;
    })
    .add("contrastingColor hex string", () => {
      let length = 0;
      for (const color of hexColors) {
        length += contrastingColor(color).length;
      }

      return length;
    });
}, { opsPerIteration: BATCH });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
