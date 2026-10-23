// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { contrastingColor } from "../src/contrast.ts";
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
