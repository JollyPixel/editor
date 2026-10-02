// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { ColorPalette } from "../src/palette/ColorPalette.ts";
import {
  colorFromKey,
  goldenAngleColor,
  hashKey
} from "../src/palette/deterministic.ts";
import {
  BATCH,
  batchOf,
  hexPair
} from "./_fixtures.ts";

const suite = defineSuite("palette", (bench) => {
  const shortKeys = batchOf((rng) => `peer-${Math.floor(rng() * 1e6)}`);
  const longKeys = batchOf(
    (rng) => Array.from({ length: 16 }, () => hexPair(rng)).join("")
  );
  const palette = new ColorPalette();

  bench
    .add("hashKey short", () => {
      let sum = 0;
      for (const key of shortKeys) {
        sum += hashKey(key);
      }

      return sum;
    })
    .add("hashKey uuid", () => {
      let sum = 0;
      for (const key of longKeys) {
        sum += hashKey(key);
      }

      return sum;
    })
    .add("colorFromKey", () => {
      let length = 0;
      for (const key of longKeys) {
        length += colorFromKey(key).length;
      }

      return length;
    })
    .add("goldenAngleColor", () => {
      let length = 0;
      for (let i = 0; i < BATCH; i++) {
        length += goldenAngleColor(i).length;
      }

      return length;
    })
    .add("ColorPalette.next", () => {
      let length = 0;
      for (let i = 0; i < BATCH; i++) {
        length += palette.next().length;
      }

      return length;
    });
}, { opsPerIteration: BATCH });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
