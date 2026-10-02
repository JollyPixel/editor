// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { toRGBA } from "../src/png/pixels.ts";
import {
  COLOR_TYPES,
  colorModel,
  samplesOf
} from "./_fixtures.ts";

// CONSTANTS
const kSize = 1024;

const suite = defineSuite("png / pixels", (bench) => {
  const palette = {
    entries: Uint8Array.from({ length: 48 }, (_, index) => index * 5),
    alpha: Uint8Array.from({ length: 8 }, (_, index) => index * 30)
  };

  for (const { name, type } of COLOR_TYPES) {
    const color = colorModel(type);
    const samples = new Uint8Array(samplesOf(kSize, type).buffer);

    bench.add(`toRGBA / ${name}`, () => {
      toRGBA(samples, color, palette);
    });
  }
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
