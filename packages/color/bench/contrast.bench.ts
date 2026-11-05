// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { Color } from "../src/Color.ts";
import { formatHex } from "../src/format.ts";
import {
  BATCH,
  createBatch,
  unitRgba
} from "./_fixtures.ts";

const suite = defineSuite("contrast", (bench) => {
  const colors = createBatch(unitRgba);
  const hexColors = colors.map((color) => formatHex(color));

  bench
    .add("Color.ink RGBA", () => {
      let sum = 0;
      for (const color of colors) {
        sum += Color.from(color).ink().r;
      }

      return sum;
    })
    .add("Color.ink hex string", () => {
      let sum = 0;
      for (const color of hexColors) {
        sum += Color.from(color).ink().r;
      }

      return sum;
    });
}, { opsPerIteration: BATCH });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
