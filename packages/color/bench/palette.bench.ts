// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { ColorSequence } from "../src/palette/ColorSequence.ts";
import { hashKey } from "../src/palette/hashKey.ts";
import {
  BATCH,
  createBatch,
  hexPair
} from "./_fixtures.ts";

const suite = defineSuite("palette", (bench) => {
  const shortKeys = createBatch((rng) => `peer-${Math.floor(rng() * 1e6)}`);
  const longKeys = createBatch(
    (rng) => Array.from({ length: 16 }, () => hexPair(rng)).join("")
  );
  const goldenAngle = ColorSequence.goldenAngle();

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
    .add("ColorSequence.default.pick", () => {
      let length = 0;
      for (const key of longKeys) {
        length += ColorSequence.default.pick(key).length;
      }

      return length;
    })
    .add("ColorSequence.goldenAngle.at", () => {
      let length = 0;
      for (let i = 0; i < BATCH; i++) {
        length += goldenAngle.at(i).length;
      }

      return length;
    });
}, { opsPerIteration: BATCH });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
