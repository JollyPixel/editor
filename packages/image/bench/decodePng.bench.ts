// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { decodePng } from "../src/png/decodePng.ts";
import {
  COLOR_TYPES,
  SIZES,
  pngOf
} from "./_fixtures.ts";

const suite = defineSuite("png / decodePng", (bench) => {
  for (const size of SIZES) {
    for (const { name, type } of COLOR_TYPES) {
      const png = pngOf(size, type);

      bench.add(`${size}x${size} / ${name}`, async() => {
        await decodePng(png);
      });
    }
  }
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
